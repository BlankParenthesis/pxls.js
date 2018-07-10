const should = require("should");
const EventEmitter = require("events");
const fs = require("fs");
const { Readable } = require("stream");

const got = require("got");
const color = require("color-parse");
const WebSocket = require("ws");
const { PNG } = require("pngjs");

/* eslint-disable no-invalid-this */
should.Assertion.add("Uint8Array", function() {
	this.params = { "operator": "to be Uint8Array" };
	this.obj.should.be.an.instanceof(Uint8Array);
});

should.Assertion.add("Readable", function() {
	this.params = { "operator": "to be Readable" };
	this.obj.should.be.an.instanceof(Readable);
});
/* eslint-enable no-invalid-this */

const defineRO = (obj, prop, val) => Object.defineProperty(obj, prop, {
	"enumerable": false,
	"configurable": false,
	"writable": false,
	"value": val
});

const wait = t => new Promise(r => setTimeout(r, t));

module.exports = class Pxls extends EventEmitter {
	constructor(site) {
		super();
		let url;

		if(typeof url === "undefined") {
			url = "pxls.space";
		} else {
			site.should.be.a.String();
			url = site;
		}

		defineRO(this, "site", url);
	}

	async connect() {
		const data = (await got(`https://${this.site}/info`, { "json": true })).body;
		this.setMetadata(data.width, data.height, data.palette, data.heatmapCooldown, data.maxStacked);
		await this.sync();
		this.clearLookupCache();
		await this.connectWS();
		this.setupListeners();
		return this.canvas;
	}

	// setup the websocket
	async connectWS() {
		if(typeof this._ws !== "undefined") {
			should(this._ws).have.property("readyState").which.is.oneOf(WebSocket.CLOSING, WebSocket.CLOSED);
		}

		const that = this;
		const reload = async () => {
			that.emit("disconnect");
		};

		return await new Promise((resolve, reject) => {
			this._ws = new WebSocket(`wss://${this.site}/ws`);
			this._ws.once("open", () => {
				this._ws.off("error", reject);
				this._ws.off("close", reject);

				this._ws.on("message", data => {
					const message = JSON.parse(data);
					switch(message.type) {
						case "pixel":
							message.pixels.forEach(p => {
								that.emit("pixel", p);
							});
							break;
						case "users":
							that.emit("users", message.count);
							break;
					}
				});
				this._ws.once("error", reload);
				this._ws.once("close", reload);
				this.emit("ready");
				resolve();
			});

			this._ws.once("error", reject);
			this._ws.once("close", reject);
		});
	}

	async restartWS() {
		should(this._ws).not.be.undefined();

		if(this._ws.readyState === WebSocket.CLOSED) {
			await this.connectWS();
		} else {
			// the restart function will be called again when the socket is fully closed
			this._ws.close();
		}
	}

	async closeWS() {
		should(this._ws).not.be.undefined();
		this._ws.removeAllListeners("error");
		this._ws.removeAllListeners("close");
		this._ws.close();
	}

	setMetadata(width, height, palette, heatmapCooldown, maxStacked) {
		should(width).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(height).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(palette).be.an.Array().and.not.empty();
		should(heatmapCooldown).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
		should(maxStacked).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);


		should(this._width).be.undefined();
		should(this._height).be.undefined();
		should(this._palette).be.undefined();
		should(this._heatmapCooldown).be.undefined();
		should(this._maxStacked).be.undefined();

		defineRO(this, "_width", width);
		defineRO(this, "_height", height);
		defineRO(this, "_palette", palette.map(e => color(e).values));
		defineRO(this, "_heatmapCooldown", heatmapCooldown);
		defineRO(this, "_maxStacked", maxStacked);
		defineRO(this, "_canvas", new Uint8Array(width * height));
		defineRO(this, "_heatmap", new Uint8Array(width * height));
		defineRO(this, "_lookupCache", new Array(width * height));

		const that = this;
		setInterval(() => {
			that.heatmap.map(b => {
				if(b > 0) {
					return b - 1;
				}
			});
		}, this.heatmapCooldown * 1000 / 256);
	}

	setupListeners() {
		this.on("pixel", p => {
			should(this.palette[p.color]).not.be.undefined();
			this.canvas[this.address(p.x, p.y)] = p.color;
		});
		this.on("users", u => {
			this._users = u;
		});
		this.on("disconnect", async () => {
			for(;;) {
				try {
					await this.restartWS();
					await this.sync();
					return;
				} catch(e) {
					process.stderr.write("Unable to connect to websocket, retrying in 5 seconds");
					await wait(5000);
				}
			}
		});
	}

	async _pipe(stream, buffer) {
		return await new Promise((resolve, reject) => {
			should(stream).be.Readable();
			should(buffer).be.a.Uint8Array();

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
		return await Promise.all([
			await this._pipe(got.stream(`https://${this.site}/heatmap`), this._heatmap),
			await this._pipe(got.stream(`https://${this.site}/boarddata`), this._canvas)
		])[1];
	}

	async lookup(x, y) {
		should(x).be.a.Number().within(0, this.width - 1);
		should(y).be.a.Number().within(0, this.height - 1);

		const index = this.address(x, y);
		const cached = this._lookupCache[index];
		if(cached) {
			return cached;
		}

		return this._lookupCache[index] = (await got(`https://${this.site}/lookup?x=${x}&y=${y}`, { "json": true })).body;
	}

	//keeps trying if the rate limit is hit
	async eventuallyLookup(x, y) {
		for(;;) {
			try {
				return await this.lookup(x, y);
			} catch(e) {
				if(!(e instanceof got.HTTPError) || e.statusCode !== 429) {
					throw e;
				}
				await wait(5000);
			}
		}
	}

	clearLookupCache() {
		this._lookupCache.fill();
	}

	async save(file) {
		should(file).be.String();

		return await new Promise((resolve, reject) => {
			this.png.pipe(fs.createWriteStream(file)).once("finish", resolve).once("error", reject);
		});
	}

	async saveHeatmap(file) {
		should(file).be.String();

		return await new Promise((resolve, reject) => {
			this.heatmapPng.pipe(fs.createWriteStream(file)).once("finish", resolve).once("error", reject);
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
			rgba.set((new Array(3)).fill(heatmap[i >> 2]), i << 2);
		}

		image.data.set(rgba);
		return image.pack();
	}

	address(x, y) {
		return (y * this.width) + x;
	}

	get users() {
		return this._users;
	}

	get width() {
		should(this._width).not.be.undefined();
		return this._width;
	}

	get height() {
		should(this._height).not.be.undefined();
		return this._height;
	}

	get palette() {
		should(this._palette).not.be.undefined();
		return this._palette;
	}

	get heatmapCooldown() {
		should(this._heatmapCooldown).not.be.undefined();
		return this._heatmapCooldown;
	}

	get maxStacked() {
		should(this._maxStacked).not.be.undefined();
		return this._maxStacked;
	}

	get canvas() {
		should(this._canvas).not.be.undefined();
		return this._canvas;
	}

	get heatmap() {
		should(this._heatmap).not.be.undefined();
		return this._heatmap;
	}

	_cropBuffer(buffer, bufferWidth, bufferHeight, x, y, width, height) {
		should(bufferWidth).be.a.Number();
		should(bufferHeight).be.a.Number();
		should(x).be.a.Number().within(0, bufferWidth);
		should(y).be.a.Number().within(0, bufferHeight);
		should(width).be.a.Number().within(0, bufferWidth);
		should(height).be.a.Number().within(0, bufferHeight);
		(x + width).should.within(0, bufferWidth);
		(y + height).should.within(0, bufferHeight);

		const croppedBuffer = new Uint8Array(width * height);
		const { canvas } = this;
		const canvasWidth = this.width;
		for(let yo = 0; yo < height; yo++) {
			const i = ((yo + y) * canvasWidth) + x;
			croppedBuffer.set(canvas.slice(i, i + width), yo * width);
		}
		return croppedBuffer;
	}

	getCroppedCanvas(x, y, width, height) {
		return this._cropBuffer(this.canvas, this.width, this.height, x, y, width, height);
	}

	_convertBufferToRGBA(buffer) {
		should(buffer).be.a.Uint8Array();
		const rgba = new Uint8Array((this.width * this.height) << 2);
		const { palette } = this;

		rgba.fill(255);

		for(let i = 0; i < buffer.length; i++) {
			rgba.set(palette[buffer[i]], i << 2);
		}
		return rgba;
	}

	get rgba() {
		return this._convertBufferToRGBA(this.canvas);
	}
};
