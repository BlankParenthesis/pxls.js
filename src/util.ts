import { Readable } from "stream";

function isObject<
	X extends {}
>(
	object: unknown
): object is X {
	return typeof object === "object" && object !== null;
}

function isArray(
	object: unknown
): object is unknown[] {
	return Array.isArray(object);
}

function hasProperty<
	X extends {}, 
	Y extends PropertyKey
>(
	object: X, 
	property: Y
): object is X & Record<Y, unknown> {
	return object.hasOwnProperty(property);
}

async function pipe(stream: Readable, buffer: Uint8Array): Promise<Uint8Array> {
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

export {
	isObject,
	isArray,
	hasProperty,
	pipe,
};
