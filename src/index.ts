import * as EventEmitter from "events";
import { inspect } from "util";

import fetch from "node-fetch";
import * as WebSocket from "ws";
import sharp = require("sharp");
import * as is from "check-types";

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

import {
	Emoji,
	Metadata,
	Metadatalike,
} from "./metadata";

import {
	TemplateKey,
	TemplateDesign,
	StylizedTemplateDesign,
	Template,
} from "./template";

import {
	Buffer2D,
	IndexMethod,
	IndexArray,
	PxlsColor,
	TRANSPARENT_PIXEL,
	PLACEMAP_NOPLACE,
} from "./buffers";

import { hasProperty, pipe, ValidationError, range, sum, wait, doWithTimeout } from "./util";

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
	PxlsColor,
	Emoji,
	Metadata,
	TemplateKey,
	IndexMethod,
	IndexArray,
	TemplateDesign,
	StylizedTemplateDesign,
	Template,
	TRANSPARENT_PIXEL,
	PLACEMAP_NOPLACE,
	Buffer2D,
};

export interface SyncData {
	metadata: Metadata;
	canvas?: Buffer2D<IndexArray>;
	heatmap?: Buffer2D<Uint8Array>;
	placemap?: Buffer2D<Uint8Array>;
	virginmap?: Buffer2D<Uint8Array>;
	initialcanvas?: Buffer2D<IndexArray>;
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
	},
};

export class Pxls extends EventEmitter {
	readonly site: string;
	private disconnected = true;
	private synced = false;
	private readonly pixelBuffer: Pixel[] = [];
	private wsVariable?: WebSocket;

	// TODO: think of a better suffix for `get`-proxied data — Variable is not great
	private metadataVariable?: Metadata;
	private userCount?: number;

	private readonly bufferRestriction: Set<BufferType>;
	private canvasdata?: Buffer2D<IndexArray>;
	private heatmapdata?: Buffer2D<Uint8Array>;
	private placemapdata?: Buffer2D<Uint8Array>;
	private virginmapdata?: Buffer2D<Uint8Array>;
	private initialcanvasdata?: Buffer2D<IndexArray>;

	readonly notifications: Notification[] = [];
	private readonly notificationBuffer: Notification[] = [];

	private wsHeartbeat?: NodeJS.Timeout;

	private heatmapCooldownInterval?: NodeJS.Timeout;

	private cooldownConfig: CooldownOptions;

	constructor(optionsOrSite?: string | PxlsOptions) {
		super();

		const options = { ...DEFAULT_OPTIONS };

		if(is.object(optionsOrSite)) {
			for(const [key, value] of Object.entries(optionsOrSite)) {
				if(hasProperty(optionsOrSite, key) && hasProperty(options, key)) {
					options[key] = value;
				}
			}
		} else if(is.string(optionsOrSite)) {
			options.site = optionsOrSite;
		} else if(!is.undefined(optionsOrSite)) {
			throw new Error(`Invalid construction option: ${optionsOrSite}`);
		}

		this.site = options.site;
		this.bufferRestriction = new Set(options.buffers);
		this.cooldownConfig = options.cooldownConfig;
	}

	private get ws(): WebSocket {
		if(is.undefined(this.wsVariable)) {
			throw new Error("Expected websocket to be defined");
		}

		return this.wsVariable;
	}

	async connect() {
		// this variable represents the desired state more than the current state.
		this.disconnected = false;

		while(!this.synced && !this.disconnected) {
			await this.disposeWebsocket();

			try {
				await this.connectWS();
				await this.sync();
				this.emit("ready");
			} catch(e) {
				await wait(30000);
			}
		}
	}

	private processPixel(pixel: Pixel) {
		if(!(pixel.color in this.palette) && pixel.color !== TRANSPARENT_PIXEL) {
			this.emit("error", new Error(
				`Tried to process pixel of unknown color: ${pixel.color}`
			));

			return;
		}
		
		if(this.bufferRestriction.has(BufferType.HEATMAP)) {
			this.heatmap.put(pixel.x, pixel.y, 255);
		}

		if(this.bufferRestriction.has(BufferType.VIRGINMAP)) {
			this.virginmap.put(pixel.x, pixel.y, 0);
		}

		if(this.bufferRestriction.has(BufferType.CANVAS)) {
			this.emit("pixel", {
				...pixel,
				"oldColor": this.canvas.get(pixel.x, pixel.y) as number,
			});

			this.canvas.put(pixel.x, pixel.y, pixel.color);
		}
	}

	private async processWSMessage(message: Message) {
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
			if(!UsersMessage.validate(message)) {
				this.emit("error", new ValidationError(message, "UsersMessage"));
				return;
			}

			this.userCount = message.count;
			
			this.emit("users", message.count);
			break;
		case "alert":
			if(!AlertMessage.validate(message)) {
				this.emit("error", new ValidationError(message, "AlertMessage"));
				return;
			}

			this.emit("alert", message);
			break;
		case "notification":
			if(!NotificationMessage.validate(message)) {
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
			if(!ChatMessageMessage.validate(message)) {
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
	}

	private async connectWS(): Promise<void> {
		if(!is.undefined(this.wsVariable)) {
			if(![WebSocket.CLOSING, WebSocket.CLOSED].includes(this.wsVariable.readyState as any)) {
				throw new Error("Cannot connect new websocket: already connected");
			}
		}

		return await new Promise((resolve, reject) => {
			const ws = this.wsVariable = new WebSocket(`wss://${this.site}/ws`);

			const HEARTBEAT_TIMEOUT = 30000 + 1000; // network timeout plus a second

			this.ws.once("open", () => {
				ws.off("error", reject);
				ws.off("close", reject);

				if(this.wsHeartbeat !== undefined) {
					clearInterval(this.wsHeartbeat);
				}
				this.wsHeartbeat = setInterval(async () => {
					try {
						ws.ping();

						await doWithTimeout(
							() => new Promise(resolve => {
								ws.once("pong", resolve);
							}),
							HEARTBEAT_TIMEOUT,
						);
					} catch(timeout) {
						ws.terminate();
					}
				}, HEARTBEAT_TIMEOUT);

				ws.on("message", data => {
					try {
						const message: unknown = JSON.parse(data.toString());
						
						if(!Message.validate(message)) {
							this.emit("error", new ValidationError(message, "Message"));
							return;
						}
						
						this.processWSMessage(message);
					} catch(e) {
						this.emit("error", e);
						ws.close();
					}
				});
				ws.once("error", e => {
					this.emit("error", e);
					ws.close();
				});
				ws.once("close", () => {
					this.emit("disconnect");
					this.connect();
				});
				resolve();
			});

			ws.once("error", reject);
			ws.once("close", reject);
		});
	}

	private async disposeWebsocket() {
		if(!is.undefined(this.wsVariable)) {
			this.ws.removeAllListeners("error");
			this.ws.removeAllListeners("close");
			
			if(!is.undefined(this.wsHeartbeat)) {
				clearInterval(this.wsHeartbeat);
			}

			if(this.ws.readyState !== WebSocket.CLOSED) {
				await new Promise(resolve => {
					this.ws.once("close", resolve);
					this.ws.close();
				});
			}

			this.wsVariable = undefined;
		}
	}

	// FIXME: calling this multiple times before the first one resolves results
	// in only one call ever resolving
	async disconnect() {
		this.synced = false;
		this.disconnected = true;

		if(!is.undefined(this.wsVariable)) {
			await this.disposeWebsocket();
			this.emit("disconnect");
		}
	}

	private setMetadata(metadata: Metadatalike) {
		this.metadataVariable = new Metadata(metadata, this.site);

		if(!is.undefined(this.heatmapCooldownInterval)) {
			clearInterval(this.heatmapCooldownInterval);
		}

		this.heatmapCooldownInterval = setInterval(() => {
			if(this.bufferRestriction.has(BufferType.HEATMAP)) {
				this.heatmapdata = new Buffer2D(
					this.heatmap.width, 
					this.heatmap.height, 
					this.heatmap.data.map(b => {
						if(b > 0) {
							return b - 1;
						} else {
							return b;
						}
					}),
				);
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

		if(!Metadata.validate(metadata)) {
			throw new Error(`Metadata failed to validate: ${inspect(metadata)}`);
		}

		this.setMetadata(metadata);

		const bufferSources = [...this.bufferSources.entries()]
			.filter(([type, _]) => this.bufferRestriction.has(type));

		const { width, height } = metadata;

		const buffers = await Promise.all(
			bufferSources.map(async ([type, url]): Promise<[string, Buffer2D<Uint8Array>]> => {
				const buffer = await pipe((await fetch(url)).body, new Uint8Array(width * height));

				switch(type) {
				case BufferType.CANVAS:
					return ["canvas", this.canvasdata = new Buffer2D(width, height, new IndexArray(buffer))];
				case BufferType.HEATMAP:
					return ["heatmap", this.heatmapdata = new Buffer2D(width, height, buffer)];
				case BufferType.PLACEMAP:
					return ["placemap", this.placemapdata = new Buffer2D(width, height, buffer)];
				case BufferType.VIRGINMAP:
					return ["virginmap", this.virginmapdata = new Buffer2D(width, height, buffer)];
				case BufferType.INITIAL_CANVAS:
					return ["initialcanvas", this.initialcanvasdata = new Buffer2D(width, height, new IndexArray(buffer))];
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

		this.emit("sync", { "metadata": this.metadata as Metadata, ...buffersSyncdata });
		this.synced = true;
	}

	/**
	 * @alias saveCanvas
	 */
	async save(file: string) {
		await this.saveCanvas(file);
	}

	private static async saveIndexedArrayColor(file: string, buffer: Buffer2D<IndexArray>, palette: PxlsColor[]) {
		await sharp(Buffer.from(buffer.data.deindex(palette)), { "raw": { 
			"width": buffer.width, 
			"height": buffer.height, 
			"channels": 4,
		} }).toFile(file);
	}

	async saveCanvas(file: string) {
		await Pxls.saveIndexedArrayColor(file, this.canvas, this.palette);
	}

	async saveInitialCanvas(file: string) {
		await Pxls.saveIndexedArrayColor(file, this.initialcanvas, this.palette);
	}

	private static async saveBufferBW(file: string, buffer: Buffer2D<Uint8Array>) {
		await sharp(Buffer.from(buffer.data), { "raw": {
			"width": buffer.width, 
			"height": buffer.height, 
			"channels": 1,
		} }).toColorspace("b-w")
			.toFile(file);
	}

	async saveHeatmap(file: string) {
		await Pxls.saveBufferBW(file, this.heatmap);
	}

	async savePlacemap(file: string) {
		await Pxls.saveBufferBW(file, this.placemap);
	}

	async saveVirginmap(file: string) {
		await Pxls.saveBufferBW(file, this.virginmap);
	}

	/**
	 * @deprecated use `Buffer2D.address` instead
	 */
	address(x: number, y: number) {
		return (y * this.width) + x;
	}

	get users() {
		if(is.undefined(this.userCount)) {
			throw new Error("User count is unknown");
		}
		return this.userCount;
	}
	
	// TODO: user count can be fetched from /users on demand

	private get metadata() {
		if(is.undefined(this.metadataVariable)) {
			throw new Error("Missing metadata");
		}

		return this.metadataVariable;
	}

	get width() {
		return this.metadata.width;
	}

	get height() {
		return this.metadata.height;
	}

	get palette() {
		return this.metadata.palette;
	}

	get heatmapCooldown() {
		return this.metadata.heatmapCooldown;
	}

	get maxStacked() {
		return this.metadata.maxStacked;
	}

	get canvasCode() {
		return this.metadata.canvasCode;
	}

	get chatEnabled() {
		return this.metadata.chatEnabled;
	}

	get chatCharacterLimit() {
		return this.metadata.chatCharacterLimit;
	}

	get chatBannerText() {
		return this.metadata.chatBannerText;
	}

	get customEmoji() {
		return this.metadata.customEmoji;
	}

	get canvas() {
		if(is.undefined(this.canvasdata)) {
			throw new Error("Missing canvas data");
		}
		return this.canvasdata;
	}
	
	get heatmap() {
		if(is.undefined(this.heatmapdata)) {
			throw new Error("Missing heatmap data");
		}
		return this.heatmapdata;
	}

	get virginmap() {
		if(is.undefined(this.virginmapdata)) {
			throw new Error("Missing virginmap data");
		}
		return this.virginmapdata;
	}
	
	get placemap() {
		if(is.undefined(this.placemapdata)) {
			throw new Error("Missing placemap data");
		}
		return this.placemapdata;
	}

	get initialcanvas() {
		if(is.undefined(this.initialcanvasdata)) {
			throw new Error("Missing initialcanvas data");
		}
		return this.initialcanvasdata;
	}

	/**
	 * @deprecated use `Buffer2D.crop` instead
	 */
	static cropBuffer(
		buffer: Uint8Array, 
		bufferWidth: number, 
		bufferHeight: number, 
		x: number, 
		y: number, 
		width: number, 
		height: number, 
		blankFill: number = TRANSPARENT_PIXEL,
	) {
		return new Buffer2D(bufferWidth, bufferHeight, buffer)
			.crop(x, y, width, height, blankFill);
	}

	/**
	 * @deprecated use `pxls.canvas.crop` instead
	 */
	cropCanvas(x: number, y: number, width: number, height: number) {
		return this.canvas.crop(x, y, width, height);
	}

	/**
	 * @deprecated use `pxls.heatmap.crop` instead
	 */
	cropHeatmap(x: number, y: number, width: number, height: number) {
		return this.heatmap.crop(x, y, width, height, 0);
	}

	/**
	 * @deprecated use `pxls.placemap.crop` instead
	 */
	cropPlacemap(x: number, y: number, width: number, height: number) {
		return this.placemap.crop(x, y, width, height, 1);
	}

	/**
	 * @deprecated use `pxls.virginmap.crop` instead
	 */
	cropVirginmap(x: number, y: number, width: number, height: number) {
		return this.virginmap.crop(x, y, width, height, 1);
	}
	
	/**
	 * @deprecated use `pxls.initialcanvas.crop` instead
	 */
	cropInitialCanvas(x: number, y: number, width: number, height: number) {
		return this.initialcanvas.crop(x, y, width, height);
	}

	/**
	 * @deprecated use `pxls.canvas.crop` instead
	 */
	getCroppedCanvas(x: number, y: number, width: number, height: number) {
		return this.canvas.crop(x, y, width, height);
	}

	/**
	 * @deprecated use `IndexArray.deindex` instead
	 */
	static convertBufferToRGBA(buffer: Uint8Array, palette: PxlsColor[]) {
		return IndexArray.prototype.deindex.call(buffer, palette);
	}

	/**
	 * @deprecated use `pxls.canvas.data.deindex(pxls.palette)` instead
	 */
	get rgba() {
		return this.canvas.data.deindex(this.palette);
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
		const cooldown = Pxls.cooldownForUserCount(users, config);
	
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
