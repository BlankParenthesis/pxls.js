import { isObject, hasProperty, isArray } from "./util";

export interface Message {
	type: string;
}

export class Message {
	static validate<M extends Message>(message: unknown): message is M {
		return isObject(message)
			&& hasProperty(message, "type")
			&& typeof message.type === "string";
	}
}

// TODO: for all message types, verify that `type` has the correct value

export interface Pixel {
	x: number;
	y: number;
	color: number;
}

export class Pixel {
	static validate<P extends Pixel>(pixel: unknown): pixel is P {
		return isObject(pixel)
			&& hasProperty(pixel, "x")
			&& typeof pixel.x === "number"
			&& hasProperty(pixel, "y")
			&& typeof pixel.y === "number"
			&& hasProperty(pixel, "color")
			&& typeof pixel.color === "number";
	}
}

export interface PixelsMessage extends Message {
	type: "pixels";
	pixels: Pixel[];
}

export class PixelsMessage {
	static validate<M extends PixelsMessage>(message: Message): message is M {
		return hasProperty(message, "pixels")
			&& isArray(message.pixels)
			&& message.pixels.every(Pixel.validate);
	}
}

export interface UsersMessage extends Message {
	type: "users";
	count: number;
}

export class UsersMessage {
	static validate<M extends UsersMessage>(message: Message): message is M {
		return hasProperty(message, "count")
			&& typeof message.count === "number";
	}
}

export interface AlertMessage extends Message {
	sender: string;
	message: string;
}

export class AlertMessage {
	static validate<M extends AlertMessage>(message: Message): message is M {
		return hasProperty(message, "sender")
			&& typeof message.sender === "string"
			&& hasProperty(message, "message")
			&& typeof message.sender === "string";
	}
}

export interface Notification {
    id: number;
    time: number;
    expiry?: number;
    who: string;
    title: string;
    content: string;
}

export class Notification {
	static validate<M extends Notification>(notification: unknown): notification is M {
		return isObject(notification)
			&& hasProperty(notification, "id")
			&& typeof notification.id === "number"
			&& hasProperty(notification, "time")
			&& typeof notification.time === "number"
			&& hasProperty(notification, "who")
			&& typeof notification.who === "string"
			&& hasProperty(notification, "title")
			&& typeof notification.title === "string"
			&& hasProperty(notification, "content")
			&& typeof notification.content === "string";
	}
}

export interface NotificationMessage extends Message {
	notification: Notification;
}

export class NotificationMessage {
	static validate<M extends NotificationMessage>(message: Message): message is M {
		return hasProperty(message, "notification")
			&& Notification.validate(message.notification);
	}
}

export interface Purge {
	initiator: string;
	reason: string;
}

export class Purge {
	static validate<M extends Purge>(purge: unknown): purge is M {
		return isObject(purge)
			&& hasProperty(purge, "initiator")
			&& typeof purge.initiator === "string"
			&& hasProperty(purge, "reason")
			&& typeof purge.reason === "string";
	}
}

export interface Badge {
     displayName: string;
     tooltip: string;
     type: string;
     cssIcon?: string;
}

export class Badge {
	static validate<M extends Badge>(badge: unknown): badge is M {
		return isObject(badge)
			&& hasProperty(badge, "displayName")
			&& typeof badge.displayName === "string"
			&& hasProperty(badge, "tooltip")
			&& typeof badge.tooltip === "string"
			&& hasProperty(badge, "type")
			&& typeof badge.type === "string"
			&& (!hasProperty(badge, "cssIcon") || typeof badge.cssIcon === "string");
	}
}

export interface StrippedFaction {
	id: number;
	name: string;
	tag?: string;
	color: number;
}

export class StrippedFaction {
	static validate<M extends StrippedFaction>(faction: unknown): faction is M {
		return isObject(faction)
			&& hasProperty(faction, "id") && typeof faction.id === "number"
			&& hasProperty(faction, "name") && typeof faction.name === "string"
			&& (!hasProperty(faction, "tag") || typeof faction.tag === "string")
			&& hasProperty(faction, "color") && typeof faction.color === "number";
	}
}

export interface ChatMessage {
    id: number;
    author: string;
    date: number;
	/* eslint-disable-next-line camelcase */
    message_raw: string;
    purge?: Purge;
    badges: Badge[];
    authorNameColor: number;
    authorWasShadowBanned?: boolean;
    strippedFaction?: StrippedFaction;
}

export class ChatMessage {
	static validate<M extends ChatMessage>(notification: unknown): notification is M {
		return isObject(notification)
			&& hasProperty(notification, "id")
			&& typeof notification.id === "number"
			&& hasProperty(notification, "author")
			&& typeof notification.author === "string"
			&& hasProperty(notification, "date")
			&& typeof notification.date === "number"
			&& hasProperty(notification, "message_raw")
			&& typeof notification.message_raw === "string"
			&& (!hasProperty(notification, "purge") || Purge.validate(notification.purge))
			&& hasProperty(notification, "badges")
			&& Array.isArray(notification.badges)
			&& notification.badges.every(Badge.validate)
			&& hasProperty(notification, "authorNameColor")
			&& typeof notification.authorNameColor === "number"
			&& (!hasProperty(notification, "authorWasShadowBanned")
				|| typeof notification.authorWasShadowBanned === "boolean")
			&& (!hasProperty(notification, "strippedFaction")
				|| StrippedFaction.validate(notification.strippedFaction));
	}
}

export interface ChatMessageMessage extends Message {
	message: ChatMessage;
}

export class ChatMessageMessage {
	static validate<M extends ChatMessageMessage>(message: Message): message is M {
		return hasProperty(message, "message")
			&& ChatMessage.validate(message.message);
	}
}
