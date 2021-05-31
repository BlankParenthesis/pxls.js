import * as should from "should";
import * as EventEmitter from "events";
import * as fs from "fs";
import { Readable } from "stream";

import * as got from "got";
import color = require("color-parse");
import * as WebSocket from "ws";
import { PNG } from "pngjs";

import { Message, Pixel, PixelsMessage, UsersMessage } from "./messages";

import { isObject, hasProperty } from "./util";

const wait = (t: number) => new Promise(r => setTimeout(r, t));

class PxlsColor {
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

interface Metadata {
	width: number;
	height: number;
	palette: PxlsColor[];
	heatmapCooldown: number;
	maxStacked: number;
	canvasCode: string;
}

interface SyncData {
	metadata: Metadata;
	canvas: Uint8Array;
	heatmap: Uint8Array;
}

declare interface Pxls {
	on(event: "ready", listener: () => void): this;
	on(event: "disconnect", listener: () => void): this;
	on(event: "pixel", listener: (pixel: Pixel & { oldColor: number }) => void): this;
	on(event: "users", listener: (users: number) => void): this;
	on(event: "sync", listener: (data: SyncData) => void): this;
	
	emit(event: "ready"): boolean;
	emit(event: "disconnect"): boolean;
	emit(event: "pixel", pixel: Pixel & { oldColor: number }): boolean;
	emit(event: "users", users: number): boolean;
	emit(event: "sync", data: SyncData): boolean;
}

class Pxls extends EventEmitter {
	readonly site: string;
	private synced = false;
	private wsVariable?: WebSocket;

	private metadata?: Metadata;
	private userCount?: number;

	private canvasdata?: Uint8Array;
	private heatmapdata?: Uint8Array;

	constructor(site: string = "pxls.space") {
		super();

		this.site = site;
	}

	get ws(): WebSocket {
		if(typeof this.wsVariable === "undefined") {
			throw new Error("Expected websocket to be defined");
		}

		return this.wsVariable;
	}

	async connect() {
		this.synced = false;
		await this.connectWS();
		await this.sync();
		this.setupListeners();
		this.emit("ready");
		return this.canvas;
	}

	// setup the websocket
	async connectWS(): Promise<void> {
		if(typeof this.wsVariable !== "undefined") {
			if(![WebSocket.CLOSING, WebSocket.CLOSED].includes(this.wsVariable.readyState as any)) {
				throw new Error("Cannot connect new websocket: already connected");
			}
		}

		const reload = async () => {
			this.emit("disconnect");
		};
		return await new Promise((resolve, reject) => {
			const ws = this.wsVariable = new WebSocket(`wss://${this.site}/ws`);
	
			this.ws.once("open", () => {
				ws.off("error", reject);
				ws.off("close", reject);

				ws.on("message", data => {
					const message: unknown = JSON.parse(data.toString());

					if(!Message.validate(message)) 
						throw new Error(`Message failed to validate: ${message}`);
					
					switch(message.type) {
					case "pixel":
						if(!PixelsMessage.validate(message)) 
							throw new Error(`PixelMessage failed to validate: ${message}`);
						if(this.synced) {
							for(const pixel of message.pixels) {
								this.emit("pixel", {
									...pixel,
									"oldColor": this.canvas[this.address(pixel.x, pixel.y)]
								});
							}
						}
						break;
					case "users":
						if(!UsersMessage.validate(message)) 
							throw new Error(`UsersMessage failed to validate: ${message}`);
						this.emit("users", message.count);
						break;
					}
				});
				ws.once("error", reload);
				ws.once("close", reload);
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
			// the restart function will be called again when the socket is fully closed
			this.ws.close();
		}
	}

	async closeWS() {
		this.ws.removeAllListeners("error");
		this.ws.removeAllListeners("close");
		this.ws.close();
	}

	setMetadata(
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

		this.canvasdata = new Uint8Array(width * height);
		this.heatmapdata = new Uint8Array(width * height);
	}

	setupListeners() {
		this.on("pixel", p => {
			if(p.color !== -1) {
				try {
					should(this.palette[p.color]).not.be.undefined();
				} catch(e) {
					return;
				}
			}
			this.canvas[this.address(p.x, p.y)] = p.color;
			this.heatmap[this.address(p.x, p.y)] = 255;
		});
		this.on("users", u => {
			this.userCount = u;
		});
		this.on("disconnect", async () => {
			for(;;) {
				try {
					this.synced = false;
					await this.restartWS();
					await this.sync();
					this.emit("ready");
					return;
				} catch(e) {
					await wait(30000);
				}
			}
		});

		setInterval(() => {
			this.heatmapdata = this.heatmap.map(b => {
				if(b > 0) {
					return b - 1;
				} else {
					return b;
				}
			});
		}, this.heatmapCooldown * 1000 / 256);
	}

	private async pipe(stream: Readable, buffer: Uint8Array): Promise<Uint8Array> {
		return await new Promise((resolve, reject) => {
			let i = 0;
			stream.on("data", b => {
				buffer.set(b, i);
				i += b.length;
			});

			stream.once("error", reject);
			stream.once("close", reject);

			stream.once("end", () => resolve(buffer));
		});
	}

	async sync() {
		const metadata = (await got(`https://${this.site}/info`, { "json": true })).body;

		const { width, height, palette, heatmapCooldown, maxStacked, canvasCode } = metadata;
		this.setMetadata(width, height, palette, heatmapCooldown, maxStacked, canvasCode);

		const [heatmap, canvas] = await Promise.all([
			this.pipe(got.stream(`https://${this.site}/heatmap`), this.heatmap),
			this.pipe(got.stream(`https://${this.site}/boarddata`), this.canvas)
		]);
		this.emit("sync", { metadata, canvas, heatmap });
		this.synced = true;
	}

	async save(file: string) {
		return await new Promise((resolve, reject) => {
			this.png.pipe(fs.createWriteStream(file))
				.once("finish", resolve)
				.once("error", reject);
		});
	}

	async saveHeatmap(file: string) {
		return await new Promise((resolve, reject) => {
			this.heatmapPng.pipe(fs.createWriteStream(file))
				.once("finish", resolve)
				.once("error", reject);
		});
	}

	get png() {
		const image = new PNG({ "width": this.width, "height": this.height });
		image.data.set(this.rgba);
		return image.pack();
	}

	get heatmapPng() {
		const image = new PNG({ "width": this.width, "height": this.height });
		const rgba = new Uint8Array((this.width * this.height) << 2);
		const { heatmap } = this;
		rgba.fill(255);

		for(let i = 0; i < heatmap.length; i++) {
			rgba.set((new Array(3)).fill(heatmap[i]), i << 2);
		}

		image.data.set(rgba);
		return image.pack();
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

	get canvas(): Uint8Array {
		if(typeof this.canvasdata === "undefined")
			throw new Error("Missing canvas data");
		return this.canvasdata;
	}
	
	get heatmap(): Uint8Array {
		if(typeof this.heatmapdata === "undefined")
			throw new Error("Missing heatmap data");
		return this.heatmapdata;
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

	getCroppedCanvas(x: number, y: number, width: number, height: number) {
		return this.cropBuffer(this.canvas, this.width, this.height, x, y, width, height);
	}

	private convertBufferToRGBA(buffer: Uint8Array) {
		const rgba = new Uint8Array((this.width * this.height) << 2);
		const { palette } = this;

		rgba.fill(255);

		for(let i = 0; i < buffer.length; i++) {
			rgba.set(palette[buffer[i]].values, i << 2);
		}
		return rgba;
	}

	get rgba() {
		return this.convertBufferToRGBA(this.canvas);
	}
}

export = Pxls;
