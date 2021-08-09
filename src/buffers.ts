
import color = require("color-parse");
import * as is from "check-types";
import * as crypto from "crypto";

import { index, diff } from "./native-wrapper";
import { hasTypedProperty } from "./util";

export const TRANSPARENT_PIXEL = 255;
// could also be 1 I guess?
export const PLACEMAP_NOPLACE = 255;

export interface PxlsColorlike {
	name: string;
	value: string;
}

export class PxlsColor {
	readonly name: string;
	readonly values: [number, number, number];

	constructor(object: PxlsColorlike) {
		this.name = object.name;
		this.values = color(`#${object.value}`).values;
	}

	static validate<C extends PxlsColorlike>(color: unknown): color is C {
		return is.object(color)
			&& hasTypedProperty(color, "name", is.string)
			&& hasTypedProperty(color, "value", is.string);
	}
}

export class Buffer2D<T extends NodeJS.TypedArray> {
	constructor(
		public readonly width: number,
		public readonly height: number, 
		public readonly data: T
	) {
		if(width * height !== data.length) {
			throw new Error("Template dimensions do not match data length");
		}
	}
	
	get hash() {
		return crypto.createHash("sha256")
			.update(this.data)
			.digest("hex");
	}

	positionToIndex(x: number, y: number) {
		return x + y * this.width;
	}

	indexToPosition(index: number) {
		const x = index % this.width;
		const y = Math.floor(index / this.width);
		return { x, y };
	}

	put(x: number, y: number, value: number | bigint) {
		this.data[this.positionToIndex(x, y)] = value;
	}

	get(x: number, y: number) {
		return this.data[this.positionToIndex(x, y)] as any;
	}

	equals(other: unknown) {
		return other instanceof Buffer2D
			&& this.width === other.width
			&& this.height === other.height
			&& diff(this.data, other.data).length === 0;
	}

	/**
	 * @returns a new cropped buffer with any newly created space filled
	 */
	crop(
		x: number, 
		y: number, 
		width: number, 
		height: number,
		blankFill: number | bigint = TRANSPARENT_PIXEL,
	) {
		// use only negative offsets (and make them positive)
		const putOffsetX = Math.max(-x, 0);
		const putOffsetY = Math.max(-y, 0);
		
		// use only positive offsets
		const takeOffsetX = Math.max(x, 0);
		const takeOffsetY = Math.max(y, 0);

		const availableWidth = this.width - takeOffsetX;
		const availableHeight = this.height - takeOffsetY;

		const croppedDataWidth = Math.min(width - putOffsetX, availableWidth);
		const croppedDataHeight = Math.min(height - putOffsetY, availableHeight);

		// NOTE: this is unsafe:
		// We can't know that the constructor of any extending class takes the 
		// same arguments as regular typedarrays. 
		// That said, I see no better way of doing this.
		type Constructor = new (length: number) => T;
		const croppedData = new (this.data.constructor as Constructor)(width * height);

		if(croppedData instanceof BigUint64Array || croppedData instanceof BigInt64Array) {
			croppedData.fill(BigInt(blankFill));
		} else {
			croppedData.fill(Number(blankFill));
		}

		for(let y = 0; y < croppedDataHeight; y++) {
			const takeLocation = (y + takeOffsetY) * this.width + takeOffsetX;
			const putLocation = (y + putOffsetY) * width + putOffsetX;
			const row = this.data.subarray(takeLocation, takeLocation + croppedDataWidth);
			croppedData.set(row as any, putLocation);
		}

		return new Buffer2D(width, height, croppedData);
	}

	/**
	 * @returns a Uint32Array of all indicies for which the current buffer and the provided one have different values.
	 */
	differences(other: Buffer2D<T>) {
		if(other.width !== this.width || other.height !== this.height) {
			throw new Error("Cannot compare buffers with different dimensions");
		}

		return diff(this.data, other.data);
	}
}

export enum IndexMethod {
	EXACT,
}

export class IndexArray extends Uint8Array {
	deindex(palette: PxlsColor[]) {
		const rgba = new Uint8Array(this.length << 2);

		rgba.fill(255);

		for(let i = 0; i < this.length; i++) {
			if(this[i] === TRANSPARENT_PIXEL) {
				rgba[(i << 2) + 3] = 0;
			} else {
				rgba.set(palette[this[i]].values, i << 2);
			}
		}
		return rgba;
	}

	static index(
		rgba: Uint8Array, 
		palette: PxlsColor[], 
		method: IndexMethod | ((pixel: Uint8Array) => number) = IndexMethod.EXACT
	) {
		if(is.function(method)) {
			const buffer = new IndexArray(rgba.length / 4);

			for(let i = 0; i < buffer.length; i++) {
				const start = i * 4;
				buffer[i] = method(rgba.subarray(start, start + 4));
			}

			return buffer;
		} else {
			switch(method) {
			case IndexMethod.EXACT:
				return new IndexArray(index(rgba, palette));
			default:
				throw new Error(`Unimplemented indexing method ${method}`);
			}
		}
	}

	equals(other: unknown) {
		return other instanceof Uint8Array
			&& this.length === other.length
			&& diff(this, other).length === 0;
	}
}