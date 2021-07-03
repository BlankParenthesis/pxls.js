"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pxls = exports.BufferType = exports.Metadata = exports.Emoji = exports.PxlsColor = exports.TRANSPARENT_PIXEL = exports.ChatMessageMessage = exports.ChatMessage = exports.NotificationMessage = exports.Notification = exports.AlertMessage = exports.UsersMessage = exports.PixelsMessage = exports.Pixel = exports.Message = void 0;
const EventEmitter = require("events");
const util_1 = require("util");
const url_1 = require("url");
const should = require("should");
const node_fetch_1 = require("node-fetch");
const color = require("color-parse");
const WebSocket = require("ws");
const sharp = require("sharp");
const messages_1 = require("./messages");
Object.defineProperty(exports, "Message", { enumerable: true, get: function () { return messages_1.Message; } });
Object.defineProperty(exports, "Pixel", { enumerable: true, get: function () { return messages_1.Pixel; } });
Object.defineProperty(exports, "PixelsMessage", { enumerable: true, get: function () { return messages_1.PixelsMessage; } });
Object.defineProperty(exports, "UsersMessage", { enumerable: true, get: function () { return messages_1.UsersMessage; } });
Object.defineProperty(exports, "AlertMessage", { enumerable: true, get: function () { return messages_1.AlertMessage; } });
Object.defineProperty(exports, "Notification", { enumerable: true, get: function () { return messages_1.Notification; } });
Object.defineProperty(exports, "NotificationMessage", { enumerable: true, get: function () { return messages_1.NotificationMessage; } });
Object.defineProperty(exports, "ChatMessage", { enumerable: true, get: function () { return messages_1.ChatMessage; } });
Object.defineProperty(exports, "ChatMessageMessage", { enumerable: true, get: function () { return messages_1.ChatMessageMessage; } });
const util_2 = require("./util");
const wait = (t) => new Promise(r => setTimeout(r, t));
exports.TRANSPARENT_PIXEL = 255;
class PxlsColor {
    constructor(object) {
        this.name = object.name;
        this.values = color(`#${object.value}`).values;
    }
    static validate(color) {
        return util_2.isObject(color)
            && util_2.hasProperty(color, "name")
            && typeof color.name === "string"
            && util_2.hasProperty(color, "value")
            && typeof color.value === "string";
    }
}
exports.PxlsColor = PxlsColor;
class Emoji {
    constructor(emoji, base) {
        this.name = emoji.name;
        this.url = new url_1.URL(emoji.emoji, base);
    }
    static validate(emoji) {
        return util_2.isObject(emoji)
            && util_2.hasProperty(emoji, "name")
            && typeof emoji.name === "string"
            && util_2.hasProperty(emoji, "emoji")
            && typeof emoji.emoji === "string";
    }
}
exports.Emoji = Emoji;
class Metadata {
    static validate(metadata) {
        return util_2.isObject(metadata)
            && util_2.hasProperty(metadata, "width")
            && typeof metadata.width === "number"
            && util_2.hasProperty(metadata, "height")
            && typeof metadata.height === "number"
            && util_2.hasProperty(metadata, "palette")
            && Array.isArray(metadata.palette)
            && metadata.palette.every(c => PxlsColor.validate(c))
            && util_2.hasProperty(metadata, "heatmapCooldown")
            && typeof metadata.heatmapCooldown === "number"
            && util_2.hasProperty(metadata, "maxStacked")
            && typeof metadata.maxStacked === "number"
            && util_2.hasProperty(metadata, "canvasCode")
            && typeof metadata.canvasCode === "string"
            && util_2.hasProperty(metadata, "chatEnabled")
            && typeof metadata.chatEnabled === "boolean"
            && util_2.hasProperty(metadata, "chatCharacterLimit")
            && typeof metadata.chatCharacterLimit === "number"
            && util_2.hasProperty(metadata, "chatBannerText")
            && Array.isArray(metadata.chatBannerText)
            && metadata.chatBannerText.every(t => typeof t === "string")
            && util_2.hasProperty(metadata, "customEmoji")
            && Array.isArray(metadata.customEmoji)
            && metadata.customEmoji.every(e => Emoji.validate(e));
    }
}
exports.Metadata = Metadata;
var BufferType;
(function (BufferType) {
    BufferType[BufferType["CANVAS"] = 0] = "CANVAS";
    BufferType[BufferType["HEATMAP"] = 1] = "HEATMAP";
    BufferType[BufferType["PLACEMAP"] = 2] = "PLACEMAP";
    BufferType[BufferType["VIRGINMAP"] = 3] = "VIRGINMAP";
    BufferType[BufferType["INITIAL_CANVAS"] = 4] = "INITIAL_CANVAS";
})(BufferType = exports.BufferType || (exports.BufferType = {}));
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
class Pxls extends EventEmitter {
    constructor(optionsOrSite) {
        super();
        this.synced = false;
        this.pixelBuffer = [];
        this.notifications = [];
        this.notificationBuffer = [];
        const options = { ...DEFAULT_OPTIONS };
        if (typeof optionsOrSite === "object") {
            for (const [key, value] of Object.entries(optionsOrSite)) {
                if (util_2.hasProperty(optionsOrSite, key) && util_2.hasProperty(options, key)) {
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
        this.cooldownConfig = options.cooldownConfig;
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
        this.emit("ready");
    }
    processPixel(pixel) {
        if (pixel.color !== exports.TRANSPARENT_PIXEL) {
            try {
                should(this.palette[pixel.color]).not.be.undefined();
            }
            catch (e) {
                return;
            }
        }
        const address = this.address(pixel.x, pixel.y);
        if (this.bufferRestriction.has(BufferType.HEATMAP)) {
            this.heatmap[address] = 255;
        }
        if (this.bufferRestriction.has(BufferType.VIRGINMAP)) {
            this.virginmap[address] = 0;
        }
        if (this.bufferRestriction.has(BufferType.CANVAS)) {
            this.emit("pixel", {
                ...pixel,
                "oldColor": this.canvas[address]
            });
            this.canvas[address] = pixel.color;
        }
    }
    // setup the websocket
    async connectWS() {
        if (typeof this.wsVariable !== "undefined") {
            if (![WebSocket.CLOSING, WebSocket.CLOSED].includes(this.wsVariable.readyState)) {
                throw new Error("Cannot connect new websocket: already connected");
            }
        }
        return await new Promise((resolve, reject) => {
            // TODO: reuse this is possible
            const ws = this.wsVariable = new WebSocket(`wss://${this.site}/ws`);
            const reload = async () => {
                if (ws.readyState !== WebSocket.CLOSED) {
                    ws.close();
                }
                if (typeof this.heartbeatTimeout !== "undefined") {
                    clearTimeout(this.heartbeatTimeout);
                }
                this.synced = false;
                while (!this.synced) {
                    try {
                        await this.connectWS();
                        await this.sync();
                        this.emit("ready");
                    }
                    catch (e) {
                        await wait(30000);
                    }
                }
            };
            const HEARTBEAT_TIMEOUT = 30000 + 1000; // network timeout plus a second
            const heartbeat = () => {
                if (typeof this.heartbeatTimeout !== "undefined") {
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
                    const message = JSON.parse(data.toString());
                    if (!messages_1.Message.validate(message)) {
                        this.emit("error", new util_2.ValidationError(message, "Message"));
                        return;
                    }
                    switch (message.type) {
                        case "pixel":
                            if (!messages_1.PixelsMessage.validate(message)) {
                                this.emit("error", new util_2.ValidationError(message, "PixelMessage"));
                                return;
                            }
                            for (const pixel of message.pixels) {
                                if (pixel.color === -1) {
                                    // I'm not sure when this is -1 and when it's 255.
                                    // The current pxls client indicates both as transparent.
                                    // On brief inspection, I couldn't find where the server sends -1.
                                    // I *know* it sends it sometimes but 🤷
                                    pixel.color = exports.TRANSPARENT_PIXEL;
                                }
                                if (this.synced) {
                                    this.processPixel(pixel);
                                }
                                else {
                                    this.pixelBuffer.push(pixel);
                                }
                            }
                            break;
                        case "users":
                            if (!messages_1.UsersMessage.validate(message)) {
                                this.emit("error", new util_2.ValidationError(message, "UsersMessage"));
                                return;
                            }
                            this.userCount = message.count;
                            this.emit("users", message.count);
                            break;
                        case "alert":
                            if (!messages_1.AlertMessage.validate(message)) {
                                this.emit("error", new util_2.ValidationError(message, "AlertMessage"));
                                return;
                            }
                            this.emit("alert", message);
                            break;
                        case "notification":
                            if (!messages_1.NotificationMessage.validate(message)) {
                                this.emit("error", new util_2.ValidationError(message, "NotificationMessage"));
                                return;
                            }
                            if (this.synced) {
                                this.notifications.push(message.notification);
                                this.emit("notification", message.notification);
                            }
                            else {
                                this.notificationBuffer.push(message.notification);
                            }
                            break;
                        case "chat_message":
                            if (!messages_1.ChatMessageMessage.validate(message)) {
                                this.emit("error", new util_2.ValidationError(message, "ChatMessageMessage"));
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
        if (this.ws.readyState === WebSocket.CLOSED) {
            await this.connectWS();
        }
        else {
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
    setMetadata(metadata) {
        should(metadata.width).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
        should(metadata.height).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
        should(metadata.palette).be.an.Array().and.not.empty();
        should(metadata.heatmapCooldown).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
        should(metadata.maxStacked).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
        should(metadata.canvasCode).be.a.String();
        const emojiBaseUrl = new url_1.URL(`https://${this.site}/emoji/`);
        this.metadata = {
            "width": metadata.width,
            "height": metadata.height,
            "palette": metadata.palette.map(c => new PxlsColor(c)),
            "heatmapCooldown": metadata.heatmapCooldown,
            "maxStacked": metadata.maxStacked,
            "canvasCode": metadata.canvasCode,
            "chatEnabled": metadata.chatEnabled,
            "chatCharacterLimit": metadata.chatCharacterLimit,
            "chatBannerText": metadata.chatBannerText,
            "customEmoji": metadata.customEmoji.map(e => new Emoji(e, emojiBaseUrl)),
        };
        if (typeof this.heatmapCooldownInterval !== "undefined") {
            clearInterval(this.heatmapCooldownInterval);
        }
        this.heatmapCooldownInterval = setInterval(() => {
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
    get bufferSources() {
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
        const notificationsPromise = node_fetch_1.default(`https://${this.site}/notifications`);
        const metadata = await (await node_fetch_1.default(`https://${this.site}/info`)).json();
        if (!Metadata.validate(metadata)) {
            throw new Error(`Metadata failed to validate: ${util_1.inspect(metadata)}`);
        }
        this.setMetadata(metadata);
        const bufferSources = [...this.bufferSources.entries()]
            .filter(([type, _]) => this.bufferRestriction.has(type));
        const buffers = await Promise.all(bufferSources.map(async ([type, url]) => {
            const buffer = await util_2.pipe((await node_fetch_1.default(url)).body, new Uint8Array(this.width * this.height));
            switch (type) {
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
        }));
        const notifications = (await notificationsPromise).body;
        if (Array.isArray(notifications)) {
            this.notifications.push(...notifications.filter(n => messages_1.Notification.validate(n)));
        }
        this.notifications.push(...this.notificationBuffer.splice(0));
        const buffersSyncdata = Object.fromEntries(buffers);
        for (const pixel of this.pixelBuffer.splice(0)) {
            this.processPixel(pixel);
        }
        this.emit("sync", { "metadata": this.metadata, ...buffersSyncdata });
        this.synced = true;
    }
    /**
     * @alias saveCanvas
     */
    async save(file) {
        await this.saveCanvas(file);
    }
    async saveBufferColor(file, buffer) {
        const { width, height } = this;
        await sharp(buffer, { "raw": {
                width,
                height,
                "channels": 4,
            } }).toFile(file);
    }
    async saveCanvas(file) {
        await this.saveBufferColor(file, this.rgba);
    }
    async saveInitialCanvas(file) {
        const rgbaBuffer = Pxls.convertBufferToRGBA(this.initialcanvas, this.palette);
        await this.saveBufferColor(file, rgbaBuffer);
    }
    async saveBufferBW(file, buffer) {
        const { width, height } = this;
        await sharp(buffer, { "raw": {
                width,
                height,
                "channels": 1,
            } }).toColorspace("b-w")
            .toFile(file);
    }
    async saveHeatmap(file) {
        await this.saveBufferBW(file, this.heatmap);
    }
    async savePlacemap(file) {
        await this.saveBufferBW(file, this.placemap);
    }
    async saveVirginmap(file) {
        await this.saveBufferBW(file, this.virginmap);
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
    get chatEnabled() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.chatEnabled;
    }
    get chatCharacterLimit() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.chatCharacterLimit;
    }
    get chatBannerText() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.chatBannerText;
    }
    get customEmoji() {
        if (typeof this.metadata === "undefined")
            throw new Error("Missing metadata");
        return this.metadata.customEmoji;
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
    get initialcanvas() {
        if (typeof this.initialcanvasdata === "undefined")
            throw new Error("Missing initialcanvas data");
        return this.initialcanvasdata;
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
    static convertBufferToRGBA(buffer, palette) {
        const rgba = new Uint8Array(buffer.length << 2);
        rgba.fill(255);
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === exports.TRANSPARENT_PIXEL) {
                rgba[(i << 2) + 3] = 0;
            }
            else {
                rgba.set(palette[buffer[i]].values, i << 2);
            }
        }
        return rgba;
    }
    get rgba() {
        return Pxls.convertBufferToRGBA(this.canvas, this.palette);
    }
    static cooldownForUserCount(users, config = DEFAULT_OPTIONS.cooldownConfig) {
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
    static cooldownForUserCountAndStackCount(users, availablePixels, config = DEFAULT_OPTIONS.cooldownConfig) {
        const cooldown = Pxls.cooldownForUserCount(users);
        if (availablePixels < 0) {
            return 0;
        }
        else if (availablePixels === 0) {
            return cooldown;
        }
        else {
            const sumToStackCount = util_2.range(0, availablePixels - 1).reduce(util_2.sum, 0);
            return (cooldown * 3) * (1 + availablePixels + sumToStackCount);
        }
    }
    currentCooldownForStackCount(availablePixels) {
        return Pxls.cooldownForUserCountAndStackCount(this.users, availablePixels, this.cooldownConfig);
    }
}
exports.Pxls = Pxls;
exports.default = Pxls;
