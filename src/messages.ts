import { isObject, hasProperty, isArray } from "./util";

interface Message {
	type: string;
}

class Message {
	static validate<M extends Message>(message: unknown): message is M {
		return isObject(message)
			&& hasProperty(message, "type")
			&& typeof message.type === "string";
	}
}

interface Pixel {
	x: number;
	y: number;
	color: number;
}

class Pixel {
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

interface PixelsMessage extends Message {
	type: "pixels";
	pixels: Pixel[];
}

class PixelsMessage {
	static validate<M extends PixelsMessage>(message: Message): message is M {
		return hasProperty(message, "pixels")
			&& isArray(message.pixels)
			&& message.pixels.every(Pixel.validate);
	}
}

interface UsersMessage extends Message {
	type: "users";
	count: number;
}

class UsersMessage {
	static validate<M extends UsersMessage>(message: Message): message is M {
		return hasProperty(message, "count")
			&& typeof message.count === "number";
	}
}

export {
	Message,
	Pixel,
	PixelsMessage,
	UsersMessage,
};
