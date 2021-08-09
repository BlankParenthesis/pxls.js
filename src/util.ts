import { inspect } from "util";
import * as is from "check-types";
import { instance } from "check-types";

export const hasProperty = function <
	X extends {}, 
	Y extends PropertyKey
>(
	object: X, 
	property: Y
): object is X & Record<Y, unknown> {
	return Object.prototype.hasOwnProperty.call(object, property);
};

// eslint doesn't like this indent style. 
// it suggest one that seems wholely inferior imo.
/* eslint-disable indent */
export const hasTypedProperty = <
	X extends {}, 
	Y extends PropertyKey,
	T,
>(
	object: X, 
	property: Y, 
	guard: (_: unknown) => _ is T
): object is X & Record<Y, T> => {
	return hasProperty(object, property) && guard(object[property]);
};

export const hasOptionalTypedProperty = <
	X extends {}, 
	Y extends PropertyKey,
	T,
>(
	object: X, 
	property: Y, 
	guard: (_: unknown) => _ is T
): object is X & Record<Y, T> => {
	return !hasProperty(object, property)
		|| hasTypedProperty(object, property, is.undefined)
		|| hasTypedProperty(object, property, guard);
};
/* eslint-enable indent */

export const pipe = async function (stream: NodeJS.ReadableStream, buffer: Uint8Array): Promise<Uint8Array> {
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
};

export class ValidationError extends Error {
	readonly object;

	constructor(object: unknown, objectName: string) {
		super(`${objectName} failed to validate: ${inspect(object)}`);

		this.object = object;
	}
}

export const range = function (start: number, end: number) {
	if(start <= end) {
		return new Array(end - start).fill(0).map((_, i) => i + start);
	} else {
		return new Array(start - end).fill(0).map((_, i) => start - i);
	}
};

export const sum = (total: number, next: number) => total + next;

export const wait = (t: number) => new Promise(r => setTimeout(r, t));

export const doWithTimeout = async function<X>(
	action: () => Promise<X>, 
	timeout: number,
): Promise<X> {
	return await Promise.race([
		new Promise((_, reject) => setTimeout(reject, timeout)) as Promise<never>,
		action(),
	]);
};
