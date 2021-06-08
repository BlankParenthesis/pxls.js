"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pxls = exports.BufferType = exports.PxlsColor = exports.UsersMessage = exports.PixelsMessage = exports.Pixel = exports.Message = void 0;
const should = require("should");
const EventEmitter = require("events");
const fs = require("fs");
const got = require("got");
const color = require("color-parse");
const WebSocket = require("ws");
const pngjs_1 = require("pngjs");
const messages_1 = require("./messages");
Object.defineProperty(exports, "Message", { enumerable: true, get: function () { return messages_1.Message; } });
Object.defineProperty(exports, "Pixel", { enumerable: true, get: function () { return messages_1.Pixel; } });
Object.defineProperty(exports, "PixelsMessage", { enumerable: true, get: function () { return messages_1.PixelsMessage; } });
Object.defineProperty(exports, "UsersMessage", { enumerable: true, get: function () { return messages_1.UsersMessage; } });
const util_1 = require("./util");
const wait = (t) => new Promise(r => setTimeout(r, t));
class PxlsColor {
    constructor(object) {
        if (!util_1.isObject(object))
            throw new Error("Invalid color: expected object");
        if (!util_1.hasProperty(object, "name"))
            throw new Error("Invalid color: missing name");
        if (typeof object.name !== "string")
            throw new Error("Invalid color: expected name to be a string");
        if (!util_1.hasProperty(object, "value"))
            throw new Error("Invalid color: missing value");
        if (typeof object.value !== "string")
            throw new Error("Invalid color: expected value to be a string");
        this.name = object.name;
        this.values = color(`#${object.value}`).values;
    }
}
exports.PxlsColor = PxlsColor;
var BufferType;
(function (BufferType) {
    BufferType[BufferType["CANVAS"] = 0] = "CANVAS";
    BufferType[BufferType["HEATMAP"] = 1] = "HEATMAP";
    BufferType[BufferType["PLACEMAP"] = 2] = "PLACEMAP";
    BufferType[BufferType["VIRGINMAP"] = 3] = "VIRGINMAP";
})(BufferType = exports.BufferType || (exports.BufferType = {}));
class Pxls extends EventEmitter {
    constructor(optionsOrSite) {
        super();
        this.synced = false;
        const options = {
            "site": "pxls.space",
            "buffers": [
                BufferType.CANVAS,
                BufferType.HEATMAP,
                BufferType.PLACEMAP,
                BufferType.VIRGINMAP,
            ],
        };
        if (typeof optionsOrSite === "object") {
            for (const [key, value] of Object.entries(optionsOrSite)) {
                if (util_1.hasProperty(optionsOrSite, key) && util_1.hasProperty(options, key)) {
                    options[key] = value;
                }
            }
        }
        else if (typeof optionsOrSite === "string") {
            options.site = optionsOrSite;
        }
        else if (typeof optionsOrSite !== "undefined") {
            throw new Error(`Invalid construction option: ${optionsOrSite}`);
        }
        this.site = options.site;
        this.bufferRestriction = new Set(options.buffers);
    }
    get ws() {
        if (typeof this.wsVariable === "undefined") {
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
    }
    // setup the websocket
    async connectWS() {
        if (typeof this.wsVariable !== "undefined") {
            if (![WebSocket.CLOSING, WebSocket.CLOSED].includes(this.wsVariable.readyState)) {
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
                    const message = JSON.parse(data.toString());
                    if (!messages_1.Message.validate(message))
                        throw new Error(`Message failed to validate: ${message}`);
                    switch (message.type) {
                        case "pixel":
                            if (!messages_1.PixelsMessage.validate(message))
                                throw new Error(`PixelMessage failed to validate: ${message}`);
                            if (this.synced) {
                                for (const pixel of message.pixels) {
                                    if (this.bufferRestriction.has(BufferType.CANVAS)) {
                                        this.emit("pixel", {
                                            ...pixel,
                                            "oldColor": this.canvas[this.address(pixel.x, pixel.y)]
                                        });
                                    }
                                    else {
                                        this.emit("pixel", pixel);
                                    }
                                }
                            }
                            break;
                        case "users":
                            if (typeof this.heartbeatTimeout !== "undefined") {
                                clearTimeout(this.heartbeatTimeout);
                            }
                            // Pxls sends this packet at least once every 10 minutes.
                            // If we don't get one for at least 11 minutes, the
                            // connection is dead.
                            this.heartbeatTimeout = setTimeout(reload, 660000);
                            if (!messages_1.UsersMessage.validate(message))
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
        if (this.ws.readyState === WebSocket.CLOSED) {
            await this.connectWS();
        }
        else {
            // the restart function will be called again when the socket is fully closed
            this.ws.close();
        }
    }
    async closeWS() {
        this.ws.removeAllListeners("error");
        this.ws.removeAllListeners("close");
        this.ws.close();
    }
    setMetadata(width, height, palette, heatmapCooldown, maxStacked, canvasCode) {
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
    }
    setupListeners() {
        this.on("pixel", p => {
            if (p.color !== -1) {
                try {
                    should(this.palette[p.color]).not.be.undefined();
                }
                catch (e) {
                    return;
                }
            }
            const address = this.address(p.x, p.y);
            if (this.bufferRestriction.has(BufferType.CANVAS)) {
                this.canvas[address] = p.color;
            }
            if (this.bufferRestriction.has(BufferType.HEATMAP)) {
                this.heatmap[address] = 255;
            }
            if (this.bufferRestriction.has(BufferType.VIRGINMAP)) {
                this.virginmap[address] = 0;
            }
        });
        this.on("users", u => {
            this.userCount = u;
        });
        this.on("disconnect", async () => {
            for (;;) {
                try {
                    this.synced = false;
                    await this.restartWS();
                    await this.sync();
                    this.emit("ready");
                    return;
                }
                catch (e) {
                    await wait(30000);
                }
            }
        });
        setInterval(() => {
            if (this.bufferRestriction.has(BufferType.HEATMAP)) {
                this.heatmapdata = this.heatmap.map(b => {
                    if (b > 0) {
                        return b - 1;
                    }
                    else {
                        return b;
                    }
                });
            }
        }, this.heatmapCooldown * 1000 / 256);
    }
    async pipe(stream, buffer) {
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
    get bufferSources() {
        return new Map([
            [BufferType.CANVAS, `https://${this.site}/boarddata`],
            [BufferType.HEATMAP, `https://${this.site}/heatmap`],
            [BufferType.PLACEMAP, `https://${this.site}/placemap`],
            [BufferType.VIRGINMAP, `https://${this.site}/virginmap`],
        ]);
    }
    async sync() {
        const metadata = (await got(`https://${this.site}/info`, { "json": true })).body;
        const { width, height, palette, heatmapCooldown, maxStacked, canvasCode } = metadata;
        this.setMetadata(width, height, palette, heatmapCooldown, maxStacked, canvasCode);
        const bufferSources = [...this.bufferSources.entries()]
            .filter(([type, _]) => this.bufferRestriction.has(type));
        const buffers = await Promise.all(bufferSources.map(async ([type, url]) => {
            const buffer = await this.pipe(got.stream(url), new Uint8Array(width * height));
            switch (type) {
                case BufferType.CANVAS:
                    return ["canvas", this.canvasdata = buffer];
                case BufferType.HEATMAP:
                    return ["canvas", this.heatmapdata = buffer];
                case BufferType.PLACEMAP:
                    return ["canvas", this.placemapdata = buffer];
                case BufferType.VIRGINMAP:
                    return ["canvas", this.virginmapdata = buffer];
                default:
                    throw new Error("Unknown buffer type used internally");
            }
        }));
        const buffersSyncdata = Object.fromEntries(buffers);
        this.emit("sync", { metadata, ...buffersSyncdata });
        this.synced = true;
    }
    static async savePng(file, png) {
        return await new Promise((resolve, reject) => {
            png.pipe(fs.createWriteStream(file))
                .once("finish", resolve)
                .once("error", reject);
        });
    }
    /**
     * @alias saveCanvas
     */
    async save(file) {
        await this.saveCanvas(file);
    }
    async saveCanvas(file) {
        await Pxls.savePng(file, this.png);
    }
    async saveHeatmap(file) {
        await Pxls.savePng(file, this.heatmapPng);
    }
    async savePlacemap(file) {
        await Pxls.savePng(file, this.placemapPng);
    }
    async saveVirginmap(file) {
        await Pxls.savePng(file, this.virginmapPng);
    }
    static pngFromGrayscaleBuffer(buffer, width, height) {
        if (buffer.length !== width * height)
            throw new Error("Incompatible buffer sizes given");
        // 0 is grayscale, no alpha.
        const colorType = 0;
        const inputColorType = 0;
        const image = new pngjs_1.PNG({ width, height, colorType, inputColorType });
        image.data.set(buffer);
        return image.pack();
    }
    get png() {
        const image = new pngjs_1.PNG({ "width": this.width, "height": this.height });
        image.data.set(this.rgba);
        return image.pack();
    }
    get heatmapPng() {
        return Pxls.pngFromGrayscaleBuffer(this.heatmap, this.width, this.height);
    }
    get placemapPng() {
        return Pxls.pngFromGrayscaleBuffer(this.placemap.map(v => v === 0 ? 0 : 255), this.width, this.height);
    }
    get virginmapPng() {
        return Pxls.pngFromGrayscaleBuffer(this.virginmap, this.width, this.height);
    }
    address(x, y) {
        return (y * this.width) + x;
    }
    get users() {
        if (typeof this.userCount === "undefined")
            throw new Error("User count is unknown");
        return this.userCount;
    }
    get width() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.width;
    }
    get height() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.height;
    }
    get palette() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.palette;
    }
    get heatmapCooldown() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.heatmapCooldown;
    }
    get maxStacked() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.maxStacked;
    }
    get canvasCode() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.canvasCode;
    }
    get canvas() {
        if (typeof this.canvasdata === "undefined")
            throw new Error("Missing canvas data");
        return this.canvasdata;
    }
    get heatmap() {
        if (typeof this.heatmapdata === "undefined")
            throw new Error("Missing heatmap data");
        return this.heatmapdata;
    }
    get virginmap() {
        if (typeof this.virginmapdata === "undefined")
            throw new Error("Missing virginmap data");
        return this.virginmapdata;
    }
    get placemap() {
        if (typeof this.placemapdata === "undefined")
            throw new Error("Missing placemap data");
        return this.placemapdata;
    }
    cropBuffer(buffer, bufferWidth, bufferHeight, x, y, width, height) {
        (bufferWidth * bufferHeight).should.be.exactly(buffer.length);
        x.should.within(0, bufferWidth);
        y.should.within(0, bufferHeight);
        width.should.within(0, bufferWidth);
        height.should.within(0, bufferHeight);
        (x + width).should.within(0, bufferWidth);
        (y + height).should.within(0, bufferHeight);
        const croppedBuffer = new Uint8Array(width * height);
        const canvasWidth = this.width;
        for (let yo = 0; yo < height; yo++) {
            const i = ((yo + y) * canvasWidth) + x;
            croppedBuffer.set(buffer.slice(i, i + width), yo * width);
        }
        return croppedBuffer;
    }
    cropCanvas(x, y, width, height) {
        return this.cropBuffer(this.canvas, this.width, this.height, x, y, width, height);
    }
    cropHeatmap(x, y, width, height) {
        return this.cropBuffer(this.heatmap, this.width, this.height, x, y, width, height);
    }
    cropPlacemap(x, y, width, height) {
        return this.cropBuffer(this.placemap, this.width, this.height, x, y, width, height);
    }
    cropVirginmap(x, y, width, height) {
        return this.cropBuffer(this.virginmap, this.width, this.height, x, y, width, height);
    }
    /**
     * @deprecated use `cropCanvas` instead
     */
    getCroppedCanvas(x, y, width, height) {
        return this.cropCanvas(x, y, width, height);
    }
    convertBufferToRGBA(buffer) {
        const rgba = new Uint8Array((this.width * this.height) << 2);
        const { palette } = this;
        rgba.fill(255);
        for (let i = 0; i < buffer.length; i++) {
            rgba.set(palette[buffer[i]].values, i << 2);
        }
        return rgba;
    }
    get rgba() {
        return this.convertBufferToRGBA(this.canvas);
    }
}
exports.Pxls = Pxls;
exports.default = Pxls;
