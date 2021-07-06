import * as is from "check-types";

import { hasTypedProperty, hasOptionalTypedProperty } from "./util";

export interface Message {
	type: string;
}

export class Message {
	static validate<M extends Message>(message: unknown): message is M {
		return is.object(message)
			&& hasTypedProperty(message, "type", is.string);
	}
}

export interface Pixel {
	x: number;
	y: number;
	color: number;
}

export class Pixel {
	static validate<P extends Pixel>(pixel: unknown): pixel is P {
		return is.object(pixel)
			&& hasTypedProperty(pixel, "x", is.number)
			&& hasTypedProperty(pixel, "y", is.number)
			&& hasTypedProperty(pixel, "color", is.number);
	}
}

export interface PixelsMessage extends Message {
	type: "pixel";
	pixels: Pixel[];
}

export class PixelsMessage {
	static validate<M extends PixelsMessage>(message: Message): message is M {
		return message.type === "pixel"
			&& hasTypedProperty(message, "pixels", is.array)
			&& message.pixels.every(Pixel.validate);
	}
}

export interface UsersMessage extends Message {
	type: "users";
	count: number;
}

export class UsersMessage {
	static validate<M extends UsersMessage>(message: Message): message is M {
		return message.type === "users"
			&& hasTypedProperty(message, "count", is.number);
	}
}

export interface AlertMessage extends Message {
	type: "alert";
	sender: string;
	message: string;
}

export class AlertMessage {
	static validate<M extends AlertMessage>(message: Message): message is M {
		return message.type === "alert"
			&& hasTypedProperty(message, "sender", is.string)
			&& hasTypedProperty(message, "message", is.string);
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
		return is.object(notification)
			&& hasTypedProperty(notification, "id", is.number)
			&& hasTypedProperty(notification, "time", is.number)
			&& hasTypedProperty(notification, "who", is.string)
			&& hasTypedProperty(notification, "title", is.string)
			&& hasTypedProperty(notification, "content", is.string);
	}
}

export interface NotificationMessage extends Message {
	type: "notification";
	notification: Notification;
}

export class NotificationMessage {
	static validate<M extends NotificationMessage>(message: Message): message is M {
		return message.type === "notification"
			&& hasTypedProperty(message, "notification", Notification.validate);
	}
}

export interface Purge {
	initiator: string;
	reason: string;
}

export class Purge {
	static validate<M extends Purge>(purge: unknown): purge is M {
		return is.object(purge)
			&& hasTypedProperty(purge, "initiator", is.string)
			&& hasTypedProperty(purge, "reason", is.string);
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
		return is.object(badge)
			&& hasTypedProperty(badge, "displayName", is.string)
			&& hasTypedProperty(badge, "tooltip", is.string)
			&& hasTypedProperty(badge, "type", is.string)
			&& hasOptionalTypedProperty(badge, "cssIcon", is.string);
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
		return is.object(faction)
			&& hasTypedProperty(faction, "id", is.number)
			&& hasTypedProperty(faction, "name", is.string)
			&& hasOptionalTypedProperty(faction, "tag", is.string)
			&& hasTypedProperty(faction, "color", is.number);
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
	static validate<M extends ChatMessage>(message: unknown): message is M {
		return is.object(message)
			&& hasTypedProperty(message, "id", is.number)
			&& hasTypedProperty(message, "author", is.string)
			&& hasTypedProperty(message, "date", is.number)
			&& hasTypedProperty(message, "message_raw", is.string)
			&& hasOptionalTypedProperty(message, "purge", Purge.validate)
			&& hasTypedProperty(message, "badges", is.array)
			&& message.badges.every(Badge.validate)
			&& hasTypedProperty(message, "authorNameColor", is.number)
			&& hasOptionalTypedProperty(message, "authorWasShadowBanned", is.boolean)
			&& hasOptionalTypedProperty(message, "strippedFaction", StrippedFaction.validate);
	}
}

export interface ChatMessageMessage extends Message {
	type: "chat_message";
	message: ChatMessage;
}

export class ChatMessageMessage {
	static validate<M extends ChatMessageMessage>(message: Message): message is M {
		return message.type === "chat_message"
			&& hasTypedProperty(message, "message", ChatMessage.validate);
	}
}
