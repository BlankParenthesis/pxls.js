"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipe = exports.hasProperty = exports.isArray = exports.isObject = void 0;
function isObject(object) {
    return typeof object === "object" && object !== null;
}
exports.isObject = isObject;
function isArray(object) {
    return Array.isArray(object);
}
exports.isArray = isArray;
function hasProperty(object, property) {
    return object.hasOwnProperty(property);
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
