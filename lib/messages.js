"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersMessage = exports.PixelsMessage = exports.Pixel = exports.Message = void 0;
const util_1 = require("./util");
class Message {
    static validate(message) {
        return util_1.isObject(message)
            && util_1.hasProperty(message, "type")
            && typeof message.type === "string";
    }
}
exports.Message = Message;
class Pixel {
    static validate(pixel) {
        return util_1.isObject(pixel)
            && util_1.hasProperty(pixel, "x")
            && typeof pixel.x === "number"
            && util_1.hasProperty(pixel, "y")
            && typeof pixel.y === "number"
            && util_1.hasProperty(pixel, "color")
            && typeof pixel.color === "number";
    }
}
exports.Pixel = Pixel;
class PixelsMessage {
    static validate(message) {
        return util_1.hasProperty(message, "pixels")
            && util_1.isArray(message.pixels)
            && message.pixels.every(Pixel.validate);
    }
}
exports.PixelsMessage = PixelsMessage;
class UsersMessage {
    static validate(message) {
        return util_1.hasProperty(message, "count")
            && typeof message.count === "number";
    }
}
exports.UsersMessage = UsersMessage;
