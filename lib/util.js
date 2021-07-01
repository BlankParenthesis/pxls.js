"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sum = exports.range = exports.ValidationError = exports.pipe = exports.hasProperty = exports.isArray = exports.isObject = void 0;
const util_1 = require("util");
function isObject(object) {
    return typeof object === "object" && object !== null;
}
exports.isObject = isObject;
function isArray(object) {
    return Array.isArray(object);
}
exports.isArray = isArray;
function hasProperty(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
}
exports.hasProperty = hasProperty;
async function pipe(stream, buffer) {
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
exports.pipe = pipe;
class ValidationError extends Error {
    constructor(object, objectName) {
        super(`${objectName} failed to validate: ${util_1.inspect(object)}`);
        this.object = object;
    }
}
exports.ValidationError = ValidationError;
function range(start, end) {
    if (start <= end) {
        return new Array(end - start).fill(0).map((_, i) => i + start);
    }
    else {
        return new Array(start - end).fill(0).map((_, i) => start - i);
    }
}
exports.range = range;
const sum = (total, next) => total + next;
exports.sum = sum;
