"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageMessage = exports.ChatMessage = exports.StrippedFaction = exports.Badge = exports.Purge = exports.NotificationMessage = exports.Notification = exports.AlertMessage = exports.UsersMessage = exports.PixelsMessage = exports.Pixel = exports.Message = void 0;
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
class AlertMessage {
    static validate(message) {
        return util_1.hasProperty(message, "sender")
            && typeof message.sender === "string"
            && util_1.hasProperty(message, "message")
            && typeof message.sender === "string";
    }
}
exports.AlertMessage = AlertMessage;
class Notification {
    static validate(notification) {
        return util_1.isObject(notification)
            && util_1.hasProperty(notification, "id")
            && typeof notification.id === "number"
            && util_1.hasProperty(notification, "time")
            && typeof notification.time === "number"
            && util_1.hasProperty(notification, "who")
            && typeof notification.who === "string"
            && util_1.hasProperty(notification, "title")
            && typeof notification.title === "string"
            && util_1.hasProperty(notification, "content")
            && typeof notification.content === "string";
    }
}
exports.Notification = Notification;
class NotificationMessage {
    static validate(message) {
        return util_1.hasProperty(message, "notification")
            && Notification.validate(message.notification);
    }
}
exports.NotificationMessage = NotificationMessage;
class Purge {
    static validate(purge) {
        return util_1.isObject(purge)
            && util_1.hasProperty(purge, "initiator")
            && typeof purge.initiator === "string"
            && util_1.hasProperty(purge, "reason")
            && typeof purge.reason === "string";
    }
}
exports.Purge = Purge;
class Badge {
    static validate(badge) {
        return util_1.isObject(badge)
            && util_1.hasProperty(badge, "displayName")
            && typeof badge.displayName === "string"
            && util_1.hasProperty(badge, "tooltip")
            && typeof badge.tooltip === "string"
            && util_1.hasProperty(badge, "type")
            && typeof badge.type === "string"
            && (!util_1.hasProperty(badge, "cssIcon") || typeof badge.cssIcon === "string");
    }
}
exports.Badge = Badge;
class StrippedFaction {
    static validate(faction) {
        return util_1.isObject(faction)
            && util_1.hasProperty(faction, "id") && typeof faction.id === "number"
            && util_1.hasProperty(faction, "name") && typeof faction.name === "string"
            && (!util_1.hasProperty(faction, "tag") || typeof faction.tag === "string")
            && util_1.hasProperty(faction, "color") && typeof faction.color === "number";
    }
}
exports.StrippedFaction = StrippedFaction;
class ChatMessage {
    static validate(notification) {
        return util_1.isObject(notification)
            && util_1.hasProperty(notification, "id")
            && typeof notification.id === "number"
            && util_1.hasProperty(notification, "author")
            && typeof notification.author === "string"
            && util_1.hasProperty(notification, "date")
            && typeof notification.date === "number"
            && util_1.hasProperty(notification, "message_raw")
            && typeof notification.message_raw === "string"
            && (!util_1.hasProperty(notification, "purge") || Purge.validate(notification.purge))
            && util_1.hasProperty(notification, "badges")
            && Array.isArray(notification.badges)
            && notification.badges.every(Badge.validate)
            && util_1.hasProperty(notification, "authorNameColor")
            && typeof notification.authorNameColor === "number"
            && (!util_1.hasProperty(notification, "authorWasShadowBanned")
                || typeof notification.authorWasShadowBanned === "boolean")
            && (!util_1.hasProperty(notification, "strippedFaction")
                || StrippedFaction.validate(notification.strippedFaction));
    }
}
exports.ChatMessage = ChatMessage;
class ChatMessageMessage {
    static validate(message) {
        return util_1.hasProperty(message, "message")
            && ChatMessage.validate(message.message);
    }
}
exports.ChatMessageMessage = ChatMessageMessage;
