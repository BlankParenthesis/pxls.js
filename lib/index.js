const should = require("should");
const EventEmitter = require("events");
const fs = require("fs");

const got = require("got");
const color = require("color-parse");
const WebSocket = require("ws");
const { PNG } = require("pngjs");


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
		defineRO(this, "_lookupCache", new Array(width * height));
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
			await this.restartWS();
			await this.sync();
		});
	}

	async sync() {
		let i = 0;

		return await new Promise((resolve, reject) => {
			const stream = got.stream(`https://${this.site}/boarddata`);

			stream.on("data", buffer => {
				this.canvas.set(buffer, i);
				i += buffer.length;
			});

			stream.once("error", reject);
			stream.once("close", reject);

			stream.once("end", () => resolve(this.canvas));
		});
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

		const png = await this.png;
		return await new Promise(resolve => {
			png.pipe(fs.createWriteStream(file)).once("finish", resolve);
		});
	}

	async png() {
		const image = new PNG({ "width": this.width, "height": this.height });
		image.data.set(this.rgba);
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

	getCroppedCanvas(x, y, width, height) {
		should(x).be.a.Number().within(0, this.width);
		should(y).be.a.Number().within(0, this.height);
		should(width).be.a.Number().within(0, this.width);
		should(height).be.a.Number().within(0, this.height);
		(x + width).should.within(0, this.width);
		(y + height).should.within(0, this.height);

		const buffer = new Uint8Array(width * height);
		const { canvas } = this;
		const canvasWidth = this.width;
		for(let yo = 0; yo < height; yo++) {
			const i = ((yo + y) * canvasWidth) + x;
			buffer.set(canvas.slice(i, i + width), yo * width);
		}
		return buffer;
	}

	get rgba() {
		const rgba = new Uint8Array((this.width * this.height) << 2);
		const { palette, canvas } = this;
		const len = canvas.length << 2;

		rgba.fill(255);

		for(let i = 0; i < len; i += 4) {
			rgba.set(palette[canvas[i >> 2]], i);
		}
		return rgba;
	}
};
