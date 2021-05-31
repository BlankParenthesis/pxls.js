"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasProperty = exports.isArray = exports.isObject = void 0;
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
