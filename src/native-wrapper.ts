import * as is from "check-types";

import { PxlsColor, TRANSPARENT_PIXEL } from "./";

let native: Record<any, Function> | undefined;
try {
	native = require("../native");
} catch(e) {
	// TODO: inform user about native module
	console.info("(pxlsspace): missing native buffer module, will use JS fallbacks");
}

export const unstylize = function(
	templateImage: Uint8Array,
	imageWidth: number,
	imageHeight: number,
	blockWidth: number,
	blockHeight: number,
): Buffer {
	if(!is.undefined(native)) {
		return native.unstylize(templateImage, imageWidth, imageHeight, blockWidth, blockHeight);
	} else {
		const width = imageWidth / blockWidth;
		const height = imageHeight / blockHeight;
		const buffer = Buffer.alloc(width * height);
		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				const blockStartIndex = x * blockWidth + y * blockHeight * imageWidth;
				const outputIndex = x + y * width;
				const votes: { [index: string]: number } = { [TRANSPARENT_PIXEL]: 0 };
				for(let blockY = 0; blockY < blockHeight; blockY++) {
					for(let blockX = 0; blockX < blockWidth; blockX++) {
						if(blockStartIndex === 0 && blockHeight * blockWidth > 1) {
							// pxlsfiddle encodes template size here — this can
							// mess with decoding, so ignore it
							continue;
						}

						const finalIndex = blockX + blockY * imageWidth + blockStartIndex;
						const color = templateImage[finalIndex];
						if(color !== TRANSPARENT_PIXEL) {
							if(!(color in votes)) {
								votes[color] = 1;
							} else {
								votes[color] += 0;
							}
						}
					}
				}
				buffer[outputIndex] = parseInt(Object.keys(votes).reduce((bestIndex, index) => {
					if(votes[index] > votes[bestIndex]) {
						return index;
					} else {
						return bestIndex;
					}
				}));
			}
		}
		return buffer;
	}
};

export const index = function (rgba: Uint8Array, palette: PxlsColor[]): Buffer {
	if(!is.undefined(native)) {
		return native.index(rgba, palette);
	} else {
		const buffer = Buffer.alloc(rgba.length / 4);
		for(let i = 0; i < buffer.length; i++) {
			const rgbaIndex = i * 4;
			const color = rgba.subarray(rgbaIndex, rgbaIndex + 4);
			const index = palette.findIndex(pxlsColor => 
				pxlsColor.values.every((v, i2) => color[i2] === v)
			);
			if(color[3] > 0 && index !== -1) {
				buffer[i] = index;
			} else {
				buffer[i] = TRANSPARENT_PIXEL;
			}
		}
		return buffer;
	}
};

export const diff = function <T extends NodeJS.TypedArray>(a: T, b: T): Uint32Array {
	if(!is.undefined(native)) {
		return native.diff(a, b);
	} else {
		return Uint32Array.from(
			Array.from(a as any)
				.map((_, index) => ({ "eq": a[index] === b[index], index }))
				.filter(({ eq }) => !eq)
				.map(({ index }) => index)
		);
	}
};

export const add = function <T extends NodeJS.TypedArray>(a: T, b: bigint | number | T): T {
	if(!is.undefined(native)) {
		return native.add(a, b);
	} else {
		// eslint-disable-next-line no-lonely-if
		if(is.arrayLike(b)) {
			return a.map((_, index) => (a[index] as any) + (b[index] as any) as any) as T;
		} else {
			// eslint-disable-next-line no-lonely-if
			if(a instanceof BigInt64Array || a instanceof BigUint64Array) {
				return a.map(value => value + BigInt(b)) as T;
			} else {
				return a.map(value => value + Number(b as any)) as T;
			}
		}
	}
};

export const multiply = function <T extends NodeJS.TypedArray>(a: T, b: bigint | number | T): T {
	if(!is.undefined(native)) {
		return native.multiply(a, b);
	} else {
		// eslint-disable-next-line no-lonely-if
		if(is.arrayLike(b)) {
			return a.map((_, index) => (a[index] as any) * (b[index] as any) as any) as T;
		} else {
			// eslint-disable-next-line no-lonely-if
			if(a instanceof BigInt64Array || a instanceof BigUint64Array) {
				return a.map(value => value * BigInt(b)) as T;
			} else {
				return a.map(value => value * Number(b as any)) as T;
			}
		}
	}
};

export const mask = function <T extends NodeJS.TypedArray>(a: T, b: T): T {
	if(!is.undefined(native)) {
		return native.mask(a, b);
	} else {
		return a.map((_, index) => (b[index] === 0 ? 0 : a[index]) as any) as T;
	}
};
