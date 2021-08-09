import { URL } from "url";

import sharp = require("sharp");
import * as is from "check-types";

import { Buffer2D, IndexArray, PxlsColor, TRANSPARENT_PIXEL, PLACEMAP_NOPLACE } from "./buffers";

import { mask, add, diff, unstylize } from "./native-wrapper";

export enum TemplateKey {
	VIEW_X = "x",
	VIEW_Y = "y",
	VIEW_SCALE = "scale",
	TEMPLATE_X = "ox",
	TEMPLATE_Y = "oy",
	TEMPLATE_SOURCE = "template",
	TEMPLATE_TITLE = "title",
	TEMPLATE_OPACITY = "oo",
	TEMPLATE_WIDTH = "tw",
}

export class TemplateDesign extends Buffer2D<IndexArray> {
	readonly size: number;

	constructor(width: number, height: number, data: IndexArray) {
		super(width, height, data);
		// Size is all non-transparent pixels.
		// In other words: the number of differences between the data and
		// a buffer of only transparent pixels.
		this.size = diff(
			this.data,
			new Uint8Array(this.data.length).fill(TRANSPARENT_PIXEL),
		).length;
	}

	async toFile(file: string, palette: PxlsColor[]) {
		await sharp(Buffer.from(this.data.deindex(palette)), { "raw": {
			"width": this.width,
			"height": this.height,
			"channels": 4,
		} }).toFile(file);
	}
	
	static async fromFile(file: string, palette: PxlsColor[]) {
		const image = sharp(file).raw();

		const { width, height } = await image.metadata();

		if(is.undefined(width)) {
			throw new Error("Image defines no width");
		}
		if(is.undefined(height)) {
			throw new Error("Image defines no height");
		}

		const buffer = IndexArray.index(
			await image.toBuffer(),
			palette,
		);

		return new TemplateDesign(width, height, buffer);
	}

	// TODO: stylize()
}

export class StylizedTemplateDesign {
	constructor(
		public readonly designWidth: number,
		public readonly designHeight: number,
		public readonly styleWidth: number,
		public readonly styleHeight: number,
		private readonly data: IndexArray,
	) {
		if(styleWidth !== Math.round(styleWidth)) {
			throw new Error("Invalid style width for deisgn");
		}

		if(styleHeight !== Math.round(styleHeight)) {
			throw new Error("Invalid style height for design");
		}

		const expectedLength = designWidth * designHeight * styleWidth * styleHeight;
		if(expectedLength !== data.length) {
			throw new Error("Template dimensions do not match data length");
		}
	}

	unstylize(): TemplateDesign {
		let data;
		if(this.styleWidth === 1 && this.styleHeight === 1) {
			data = this.data;
		} else {
			data = new IndexArray(unstylize(
				this.data,
				this.designWidth * this.styleWidth,
				this.designHeight * this.styleHeight,
				this.styleWidth,
				this.styleHeight,
			));
		}

		return new TemplateDesign(
			this.designWidth,
			this.designHeight,
			data,
		);
	}
}

export class Template {
	constructor(
		readonly design: TemplateDesign,
		readonly x: number,
		readonly y: number,
		readonly title?: string,
		readonly source?: URL,
	) {}

	get width() {
		return this.design.width;
	}

	get height() {
		return this.design.height;
	}

	get size() {
		return this.design.size;
	}

	get data() {
		return this.design.data;
	}

	link(site = "pxls.space", params = {}) {
		if(is.undefined(this.source)) {
			throw new Error("tried to generate a link for a template without a source");
		}

		return new URL(`https://${site}#${
			Object.entries({
				[TemplateKey.VIEW_X]: this.x + this.width / 2,
				[TemplateKey.VIEW_Y]: this.y + this.height / 2,
				[TemplateKey.VIEW_SCALE]: 4,
				[TemplateKey.TEMPLATE_SOURCE]: this.source,
				[TemplateKey.TEMPLATE_X]: this.x,
				[TemplateKey.TEMPLATE_Y]: this.y,
				[TemplateKey.TEMPLATE_WIDTH]: this.width,
				[TemplateKey.TEMPLATE_TITLE]: this.title,
				[TemplateKey.TEMPLATE_OPACITY]: 1,
				...params,
			}).filter((e): e is [string, Exclude<typeof e[1], undefined>] => !is.undefined(e[1]))
				.map(e => e.map(c => encodeURIComponent(c.toString())))
				.map(e => e.join("="))
				.join("&")
		}`);
	}

	differences(canvas: Buffer2D<IndexArray>) {
		// the canvas area corresponding to this template's bounding box
		const shadow = canvas.crop(this.x, this.y, this.width, this.height);
		// shifted so that transparent pixels = 0
		const designShifted = add(this.design.data, -TRANSPARENT_PIXEL);
		const shadowShifted = add(shadow.data, -TRANSPARENT_PIXEL);

		return diff(
			designShifted,
			// mask the shadow, setting all 0 (transparent) pixels on the 
			// design to be 0 (transparent) on the shadow too.
			mask(shadowShifted, designShifted),
		);
	}

	placeableSize(placemap: Buffer2D<Uint8Array>) {
		// the placemap area corresponding to this template's bounding box
		const shadow = placemap.crop(this.x, this.y, this.width, this.height);
		// shifted so that transparent pixels = 0
		const designShifted = add(this.design.data, -TRANSPARENT_PIXEL);
		const shadowShifted = add(shadow.data, -PLACEMAP_NOPLACE);

		return diff(
			// mask so only non-transparent, placable pixels are non-zero
			mask(designShifted, shadowShifted),
			// Comparing to a zero-filled buffer returns a list of all non-zero indices.
			new Uint8Array(this.data.length),
		).length;
	}

	redesigned(design: TemplateDesign) {
		return new Template(design, this.x, this.y, this.title, this.source);
	}
	
	repositioned(x: number, y: number) {
		return new Template(this.design, x, y, this.title, this.source);
	}
	
	retitled(title?: string) {
		return new Template(this.design, this.x, this.y, title, this.source);
	}
	
	resourced(source?: URL) {
		return new Template(this.design, this.x, this.y, this.title, source);
	}

	equals(other: unknown) {
		return other instanceof Template
			&& this.x === other.x
			&& this.y === other.y
			&& this.design.equals(other.design);
	}
}
