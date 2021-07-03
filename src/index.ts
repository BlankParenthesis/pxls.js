import * as EventEmitter from "events";
import { inspect } from "util";

import * as should from "should";

import fetch from "node-fetch";
import color = require("color-parse");
import * as WebSocket from "ws";
import sharp = require("sharp");

import { 
	Message, 
	Pixel, 
	PixelsMessage, 
	UsersMessage, 
	AlertMessage, 
	Notification, 
	NotificationMessage,
	ChatMessage,
	ChatMessageMessage,
} from "./messages";

import { isObject, hasProperty, pipe, ValidationError, range, sum } from "./util";

const wait = (t: number) => new Promise(r => setTimeout(r, t));

export { 
	Message, 
	Pixel, 
	PixelsMessage, 
	UsersMessage, 
	AlertMessage, 
	Notification, 
	NotificationMessage,
	ChatMessage,
	ChatMessageMessage,
};

export const TRANSPARENT_PIXEL = 255;

export class PxlsColor {
	public readonly name: string;
	public readonly values: [number, number, number];

	constructor(object: unknown) {
		if(!isObject(object)) 
			throw new Error("Invalid color: expected object");
		if(!hasProperty(object, "name")) 
			throw new Error("Invalid color: missing name");
		if(typeof object.name !== "string") 
			throw new Error("Invalid color: expected name to be a string");
		if(!hasProperty(object, "value")) 
			throw new Error("Invalid color: missing value");
		if(typeof object.value !== "string") 
			throw new Error("Invalid color: expected value to be a string");

		this.name = object.name;
		this.values = color(`#${object.value}`).values;
	}
}

export interface Metadata {
	// TODO: add metadata
	width: number;
	height: number;
	palette: PxlsColor[];
	heatmapCooldown: number;
	maxStacked: number;
	canvasCode: string;
}

export class Metadata {
	static validate<M extends Metadata>(metadata: unknown): metadata is M {
		return isObject(metadata)
			&& hasProperty(metadata, "width")
			&& typeof metadata.width === "number"
			&& hasProperty(metadata, "height")
			&& typeof metadata.height === "number"
			&& hasProperty(metadata, "palette")
			&& Array.isArray(metadata.palette)
			&& hasProperty(metadata, "heatmapCooldown")
			&& typeof metadata.heatmapCooldown === "number"
			&& hasProperty(metadata, "maxStacked")
			&& typeof metadata.maxStacked === "number"
			&& hasProperty(metadata, "canvasCode")
			&& typeof metadata.canvasCode === "string";
	}
}

export interface SyncData {
	metadata: Metadata;
	canvas?: Uint8Array;
	heatmap?: Uint8Array;
	placemap?: Uint8Array;
	virginmap?: Uint8Array;
}

export interface Pxls {
	on(event: "ready", listener: () => void): this;
	on(event: "error", listener: (error: Error) => void): this;
	on(event: "disconnect", listener: () => void): this;
	on(event: "pixel", listener: (pixel: Pixel & { oldColor?: number }) => void): this;
	on(event: "users", listener: (users: number) => void): this;
	on(event: "sync", listener: (data: SyncData) => void): this;
	on(event: "alert", listener: (alert: AlertMessage) => void): this;
	on(event: "notification", listener: (notification: Notification) => void): this;
	on(event: "chatmessage", listener: (message: ChatMessage) => void): this;
	
	emit(event: "ready"): boolean;
	emit(event: "error", error: Error): boolean;
	emit(event: "disconnect"): boolean;
	emit(event: "pixel", pixel: Pixel & { oldColor?: number }): boolean;
	emit(event: "users", users: number): boolean;
	emit(event: "sync", data: SyncData): boolean;
	emit(event: "alert", notification: AlertMessage): boolean;
	emit(event: "notification", notification: Notification): boolean;
	emit(event: "chatmessage", message: ChatMessage): boolean;
}

export enum BufferType {
	CANVAS = 0,
	HEATMAP = 1,
	PLACEMAP = 2,
	VIRGINMAP = 3,
	INITIAL_CANVAS = 4,
}

export interface CooldownOptions {
	globalOffset: number; 
	userOffset: number; 
	steepness: number; 
	multiplier: number; 
}

export interface PxlsOptions {
	site?: string;
	buffers?: ArrayLike<BufferType>;
	cooldownConfig?: CooldownOptions;
}

const DEFAULT_OPTIONS = {
	"site": "pxls.space",
	"buffers": [
		BufferType.CANVAS,
		BufferType.HEATMAP,
		BufferType.PLACEMAP,
		BufferType.VIRGINMAP,
		BufferType.INITIAL_CANVAS,
	],
	"cooldownConfig": {
		"globalOffset": 6.5,
		"userOffset": 11.96,
		"steepness": 2.5,
		"multiplier": 1,
	}
};

export class Pxls extends EventEmitter {
	readonly site: string;
	private synced = false;
	private readonly pixelBuffer: Pixel[] = [];
	private wsVariable?: WebSocket;

	private metadata?: Metadata;
	private userCount?: number;

	private readonly bufferRestriction: Set<BufferType>;
	private canvasdata?: Uint8Array;
	private heatmapdata?: Uint8Array;
	private placemapdata?: Uint8Array;
	private virginmapdata?: Uint8Array;
	private initialcanvasdata?: Uint8Array;

	readonly notifications: Notification[] = [];
	private readonly notificationBuffer: Notification[] = [];

	private heartbeatTimeout?: NodeJS.Timeout;

	private heatmapCooldownInterval?: NodeJS.Timeout;

	private cooldownConfig: CooldownOptions;

	constructor(optionsOrSite?: string | PxlsOptions) {
		super();

		const options = { ...DEFAULT_OPTIONS };

		if(typeof optionsOrSite === "object") {
			for(const [key, value] of Object.entries(optionsOrSite)) {
				if(hasProperty(optionsOrSite, key) && hasProperty(options, key)) {
					options[key] = value;
				}
			}
		} else if(typeof optionsOrSite === "string") {
			options.site = optionsOrSite;
		} else if(typeof optionsOrSite !== "undefined") {
			throw new Error(`Invalid construction option: ${optionsOrSite}`);
		}

		this.site = options.site;
		this.bufferRestriction = new Set(options.buffers);
		this.cooldownConfig = options.cooldownConfig;
	}

	private get ws(): WebSocket {
		if(typeof this.wsVariable === "undefined") {
			throw new Error("Expected websocket to be defined");
		}

		return this.wsVariable;
	}

	async connect() {
		this.synced = false;
		await this.connectWS();
		await this.sync();
		this.emit("ready");
	}

	private processPixel(pixel: Pixel) {
		if(pixel.color !== TRANSPARENT_PIXEL) {
			try {
				should(this.palette[pixel.color]).not.be.undefined();
			} catch(e) {
				return;
			}
		}
		
		const address = this.address(pixel.x, pixel.y);

		if(this.bufferRestriction.has(BufferType.HEATMAP)) {
			this.heatmap[address] = 255;
		}

		if(this.bufferRestriction.has(BufferType.VIRGINMAP)) {
			this.virginmap[address] = 0;
		}

		if(this.bufferRestriction.has(BufferType.CANVAS)) {
			this.emit("pixel", {
				...pixel,
				"oldColor": this.canvas[address]
			});

			this.canvas[address] = pixel.color;
		}
	}

	// setup the websocket
	private async connectWS(): Promise<void> {
		if(typeof this.wsVariable !== "undefined") {
			if(![WebSocket.CLOSING, WebSocket.CLOSED].includes(this.wsVariable.readyState as any)) {
				throw new Error("Cannot connect new websocket: already connected");
			}
		}

		return await new Promise((resolve, reject) => {
			// TODO: reuse this is possible
			const ws = this.wsVariable = new WebSocket(`wss://${this.site}/ws`);

			const reload = async () => {
				if(ws.readyState !== WebSocket.CLOSED) {
					ws.close();
				}

				if(typeof this.heartbeatTimeout !== "undefined") {
					clearTimeout(this.heartbeatTimeout);
				}
	
				this.synced = false;

				while(!this.synced) {
					try {
						await this.connectWS();
						await this.sync();
						this.emit("ready");
					} catch(e) {
						await wait(30000);
					}
				}
			};

			const HEARTBEAT_TIMEOUT = 30000 + 1000; // network timeout plus a second

			const heartbeat = () => {
				if(typeof this.heartbeatTimeout !== "undefined") {
					clearTimeout(this.heartbeatTimeout);
				}

				this.heartbeatTimeout = setTimeout(() => ws.terminate(), HEARTBEAT_TIMEOUT);
			};
	
			this.ws.once("open", () => {
				ws.off("error", reject);
				ws.off("close", reject);

				heartbeat();
				ws.on("ping", heartbeat);

				ws.on("message", data => {
					const message: unknown = JSON.parse(data.toString());

					if(!Message.validate(message))  {
						this.emit("error", new ValidationError(message, "Message"));
						return;
					}
					
					switch(message.type) {
					case "pixel":
						if(!PixelsMessage.validate(message)) {
							this.emit("error", new ValidationError(message, "PixelMessage"));
							return;
						}

						for(const pixel of message.pixels) {
							if(pixel.color === -1) {
								// I'm not sure when this is -1 and when it's 255.
								// The current pxls client indicates both as transparent.
								// On brief inspection, I couldn't find where the server sends -1.
								// I *know* it sends it sometimes but 🤷
								pixel.color = TRANSPARENT_PIXEL;
							}

							if(this.synced) {
								this.processPixel(pixel);
							} else {
								this.pixelBuffer.push(pixel);
							}
						}
						break;
					case "users":
						if(!UsersMessage.validate(message))  {
							this.emit("error", new ValidationError(message, "UsersMessage"));
							return;
						}

						this.userCount = message.count;
						
						this.emit("users", message.count);
						break;
					case "alert":
						if(!AlertMessage.validate(message))  {
							this.emit("error", new ValidationError(message, "AlertMessage"));
							return;
						}

						this.emit("alert", message);
						break;
					case "notification":
						if(!NotificationMessage.validate(message))  {
							this.emit("error", new ValidationError(message, "NotificationMessage"));
							return;
						}

						if(this.synced) {
							this.notifications.push(message.notification);
							this.emit("notification", message.notification);
						} else {
							this.notificationBuffer.push(message.notification);
						}

						break;
					case "chat_message":
						if(!ChatMessageMessage.validate(message))  {
							this.emit("error", new ValidationError(message, "ChatMessageMessage"));
							return;
						}

						// NOTE: I'm not storing a buffer chat messages here.
						// While that could be handy, pxls' official instance seems
						// mostly against third-parties collecting that sort of data.

						// You are encouraged not to store this long-term if running
						// against the official instance.
						this.emit("chatmessage", message.message);
							
						break;
					}
				});
				ws.once("error", e => {
					this.emit("error", e);
					ws.close();
				});
				ws.once("close", () => {
					this.emit("disconnect");
					reload();
				});
				resolve();
			});

			
			ws.once("error", reject);
			ws.once("close", reject);
		});
	}

	async restartWS() {
		if(this.ws.readyState === WebSocket.CLOSED) {
			await this.connectWS();
		} else {
			// the restart function will be called again when the socket is fully closed.
			// TODO: this function should await for that to actually happen.
			this.ws.close();
		}
	}

	async closeWS() {
		this.ws.removeAllListeners("error");
		this.ws.removeAllListeners("close");
		this.ws.close();
		// The moment we disconnect, our data becomes potentially outdated.
		this.synced = false;
		// TODO: this should probably wait for the socket actually being closed if possible.
	}

	private setMetadata(
		width: number, 
		height: number, 
		palette: unknown[], 
		heatmapCooldown: number, 
		maxStacked: number, 
		canvasCode: string,
	) {
		should(width).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(height).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(palette).be.an.Array().and.not.empty();
		should(heatmapCooldown).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
		should(maxStacked).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
		should(canvasCode).be.a.String();

		this.metadata = {
			"width": width,
			"height": height,
			"palette": palette.map(e => new PxlsColor(e)),
			"heatmapCooldown": heatmapCooldown,
			"maxStacked": maxStacked,
			"canvasCode": canvasCode,
		};

		if(typeof this.heatmapCooldownInterval !== "undefined") {
			clearInterval(this.heatmapCooldownInterval);
		}

		this.heatmapCooldownInterval = setInterval(() => {
			if(this.bufferRestriction.has(BufferType.HEATMAP)) {
				this.heatmapdata = this.heatmap.map(b => {
					if(b > 0) {
						return b - 1;
					} else {
						return b;
					}
				});
			}
		}, this.heatmapCooldown * 1000 / 256);
	}

	private get bufferSources() {
		return new Map([
			[BufferType.CANVAS, `https://${this.site}/boarddata`],
			[BufferType.HEATMAP, `https://${this.site}/heatmap`],
			[BufferType.PLACEMAP, `https://${this.site}/placemap`],
			[BufferType.VIRGINMAP, `https://${this.site}/virginmap`],
			[BufferType.INITIAL_CANVAS, `https://${this.site}/initialboarddata`],
		]);
	}

	async sync() {
		// awaiting later makes this parallel
		// at least, that's the theory I'm working on.
		const notificationsPromise = fetch(`https://${this.site}/notifications`);

		const metadata: unknown = await (await fetch(`https://${this.site}/info`)).json();

		// TODO: probably do this differently
		if(!Metadata.validate(metadata)) {
			throw new Error(`Metadata failed to validate: ${inspect(metadata)}`);
		}

		const { width, height, palette, heatmapCooldown, maxStacked, canvasCode } = metadata;
		this.setMetadata(width, height, palette, heatmapCooldown, maxStacked, canvasCode);

		const bufferSources = [...this.bufferSources.entries()]
			.filter(([type, _]) => this.bufferRestriction.has(type));

		const buffers = await Promise.all(
			bufferSources.map(async ([type, url]): Promise<[string, Uint8Array]> => {
				const buffer = await pipe((await fetch(url)).body, new Uint8Array(width * height));

				switch(type) {
				case BufferType.CANVAS:
					return ["canvas", this.canvasdata = buffer];
				case BufferType.HEATMAP:
					return ["canvas", this.heatmapdata = buffer];
				case BufferType.PLACEMAP:
					return ["canvas", this.placemapdata = buffer];
				case BufferType.VIRGINMAP:
					return ["canvas", this.virginmapdata = buffer];
				case BufferType.INITIAL_CANVAS:
					return ["canvas", this.initialcanvasdata = buffer];
				default:
					throw new Error("Unknown buffer type used internally");
				}
			})
		);

		const notifications: unknown = (await notificationsPromise).body;

		if(Array.isArray(notifications)) {
			this.notifications.push(...notifications.filter(n => Notification.validate(n)));
		}

		this.notifications.push(...this.notificationBuffer.splice(0));

		const buffersSyncdata = Object.fromEntries(buffers);

		for(const pixel of this.pixelBuffer.splice(0)) {
			this.processPixel(pixel);
		}

		this.emit("sync", { metadata, ...buffersSyncdata });
		this.synced = true;
	}

	/**
	 * @alias saveCanvas
	 */
	async save(file: string) {
		await this.saveCanvas(file);
	}

	private async saveBufferColor(file: string, buffer: Uint8Array) {
		const { width, height } = this;

		await sharp(buffer as Buffer, { "raw": { 
			width, 
			height, 
			"channels": 4,
		} }).toFile(file);
	}

	async saveCanvas(file: string) {
		await this.saveBufferColor(file, this.rgba);
	}

	async saveInitialCanvas(file: string) {
		const rgbaBuffer = Pxls.convertBufferToRGBA(this.initialcanvas, this.palette);

		await this.saveBufferColor(file, rgbaBuffer);
	}

	private async saveBufferBW(file: string, buffer: Uint8Array) {
		const { width, height } = this;

		await sharp(buffer as Buffer, { "raw": {
			width, 
			height, 
			"channels": 1,
		} }).toColorspace("b-w")
			.toFile(file);
	}

	async saveHeatmap(file: string) {
		await this.saveBufferBW(file, this.heatmap);
	}

	async savePlacemap(file: string) {
		await this.saveBufferBW(file, this.placemap);
	}

	async saveVirginmap(file: string) {
		await this.saveBufferBW(file, this.virginmap);
	}

	address(x: number, y: number) {
		return (y * this.width) + x;
	}

	get users(): number {
		if(typeof this.userCount === "undefined")
			throw new Error("User count is unknown");
		return this.userCount;
	}

	get width(): number {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.width;
	}

	get height(): number {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.height;
	}

	get palette(): PxlsColor[] {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.palette;
	}

	get heatmapCooldown(): number {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.heatmapCooldown;
	}

	get maxStacked(): number {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.maxStacked;
	}

	get canvasCode(): string {
		if(typeof this.metadata === "undefined")
			throw new Error("Missing metadata");
		return this.metadata.canvasCode;
	}

	get canvas() {
		if(typeof this.canvasdata === "undefined")
			throw new Error("Missing canvas data");
		return this.canvasdata;
	}
	
	get heatmap() {
		if(typeof this.heatmapdata === "undefined")
			throw new Error("Missing heatmap data");
		return this.heatmapdata;
	}

	get virginmap() {
		if(typeof this.virginmapdata === "undefined")
			throw new Error("Missing virginmap data");
		return this.virginmapdata;
	}
	
	get placemap() {
		if(typeof this.placemapdata === "undefined")
			throw new Error("Missing placemap data");
		return this.placemapdata;
	}

	get initialcanvas() {
		if(typeof this.initialcanvasdata === "undefined")
			throw new Error("Missing initialcanvas data");
		return this.initialcanvasdata;
	}

	private cropBuffer(
		buffer: Uint8Array, 
		bufferWidth: number, 
		bufferHeight: number, 
		x: number, 
		y: number, 
		width: number, 
		height: number,
	) {
		(bufferWidth * bufferHeight).should.be.exactly(buffer.length);
		x.should.within(0, bufferWidth);
		y.should.within(0, bufferHeight);
		width.should.within(0, bufferWidth);
		height.should.within(0, bufferHeight);
		(x + width).should.within(0, bufferWidth);
		(y + height).should.within(0, bufferHeight);

		const croppedBuffer = new Uint8Array(width * height);
		const canvasWidth = this.width;
		for(let yo = 0; yo < height; yo++) {
			const i = ((yo + y) * canvasWidth) + x;
			croppedBuffer.set(buffer.slice(i, i + width), yo * width);
		}
		return croppedBuffer;
	}

	cropCanvas(x: number, y: number, width: number, height: number) {
		return this.cropBuffer(this.canvas, this.width, this.height, x, y, width, height);
	}

	cropHeatmap(x: number, y: number, width: number, height: number) {
		return this.cropBuffer(this.heatmap, this.width, this.height, x, y, width, height);
	}

	cropPlacemap(x: number, y: number, width: number, height: number) {
		return this.cropBuffer(this.placemap, this.width, this.height, x, y, width, height);
	}

	cropVirginmap(x: number, y: number, width: number, height: number) {
		return this.cropBuffer(this.virginmap, this.width, this.height, x, y, width, height);
	}

	/**
	 * @deprecated use `cropCanvas` instead
	 */
	getCroppedCanvas(x: number, y: number, width: number, height: number) {
		return this.cropCanvas(x, y, width, height);
	}

	static convertBufferToRGBA(buffer: Uint8Array, palette: PxlsColor[]) {
		const rgba = new Uint8Array(buffer.length << 2);

		rgba.fill(255);

		for(let i = 0; i < buffer.length; i++) {
			if(buffer[i] === TRANSPARENT_PIXEL) {
				rgba[(i << 2) + 3] = 0;
			} else {
				rgba.set(palette[buffer[i]].values, i << 2);
			}
		}
		return rgba;
	}

	get rgba() {
		return Pxls.convertBufferToRGBA(this.canvas, this.palette);
	}

	static cooldownForUserCount(
		users: number, 
		config: CooldownOptions = DEFAULT_OPTIONS.cooldownConfig
	) {
		const { globalOffset, userOffset, steepness, multiplier } = config; 
		return (steepness * Math.sqrt(users + userOffset) + globalOffset) * multiplier;
	}

	get currentCooldown() {
		return Pxls.cooldownForUserCount(this.users, this.cooldownConfig);
	}

	/**
	 * To get the total time to get some stack count, Call this once at every stack stage.
	 * Example for final stack count = 5:
	 * `[0, 1, 2, 3, 4].reduce((cooldown, stackSize) => cooldown + currentCooldownForStackCount(stackSize), 0)`
	 * @returns The time in seconds the stacked pixel count is `availablePixels` before becoming `availablePixels + 1`
	 */
	static cooldownForUserCountAndStackCount(
		users: number, 
		availablePixels: number,
		config: CooldownOptions = DEFAULT_OPTIONS.cooldownConfig
	) {
		const cooldown = Pxls.cooldownForUserCount(users);
	
		if(availablePixels < 0) {
			return 0;
		} else if(availablePixels === 0) {
			return cooldown;
		} else {
			const sumToStackCount = range(0, availablePixels - 1).reduce(sum, 0);

			return (cooldown * 3) * (1 + availablePixels + sumToStackCount);
		}
	}

	currentCooldownForStackCount(availablePixels: number) {
		return Pxls.cooldownForUserCountAndStackCount(
			this.users, 
			availablePixels, 
			this.cooldownConfig
		);
	}
}

export default Pxls;
