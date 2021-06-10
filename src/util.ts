import { inspect } from "util";
import { Readable } from "stream";

export function isObject<
	X extends {}
>(
	object: unknown
): object is X {
	return typeof object === "object" && object !== null;
}

export function isArray(
	object: unknown
): object is unknown[] {
	return Array.isArray(object);
}

export function hasProperty<
	X extends {}, 
	Y extends PropertyKey
>(
	object: X, 
	property: Y
): object is X & Record<Y, unknown> {
	return Object.prototype.hasOwnProperty.call(object, property);
}

export async function pipe(stream: Readable, buffer: Uint8Array): Promise<Uint8Array> {
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

export class ValidationError extends Error {
	readonly object;

	constructor(object: unknown, objectName: string) {
		super(`${objectName} failed to validate: ${inspect(object)}`);

		this.object = object;
	}
}
