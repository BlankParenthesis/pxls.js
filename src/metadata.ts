import { URL } from "url";

import color = require("color-parse");
import * as should from "should";
import * as is from "check-types";

import { hasTypedProperty } from "./util";

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

export interface Emojilike {
	name: string;
	emoji: string;
}

export class Emoji {
	readonly name: string;
	readonly url: URL;

	constructor(emoji: Emojilike, base: URL) {
		this.name = emoji.name;
		this.url = new URL(emoji.emoji, base);
	}

	static validate<E extends Emojilike>(emoji: unknown): emoji is E {
		return is.object(emoji)
			&& hasTypedProperty(emoji, "name", is.string)
			&& hasTypedProperty(emoji, "emoji", is.string);
	}
}

export interface Metadatalike {
	width: number;
	height: number;
	palette: PxlsColorlike[];
	heatmapCooldown: number;
	maxStacked: number;
	canvasCode: string;
	chatEnabled: boolean;
	chatCharacterLimit: number;
	chatBannerText: string[];
	customEmoji: Emojilike[];
}

export class Metadata {
	readonly width: number;
	readonly height: number;
	readonly palette: PxlsColor[];
	readonly heatmapCooldown: number;
	readonly maxStacked: number;
	readonly canvasCode: string;
	readonly chatEnabled: boolean;
	readonly chatCharacterLimit: number;
	readonly chatBannerText: string[];
	readonly customEmoji: Emoji[];

	constructor(metadata: Metadatalike, site: string) {
		should(metadata.width).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(metadata.height).be.a.Number().and.not.Infinity().and.not.NaN().and.above(0);
		should(metadata.palette).be.an.Array().and.not.empty();
		should(metadata.heatmapCooldown).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
		should(metadata.maxStacked).be.a.Number().and.not.Infinity().and.not.NaN().and.aboveOrEqual(0);
		should(metadata.canvasCode).be.a.String();

		const emojiBaseUrl = new URL(`https://${site}/emoji/`);

		this.width = metadata.width;
		this.height = metadata.height;
		this.palette = metadata.palette.map(c => new PxlsColor(c));
		this.heatmapCooldown = metadata.heatmapCooldown;
		this.maxStacked = metadata.maxStacked;
		this.canvasCode = metadata.canvasCode;
		this.chatEnabled = metadata.chatEnabled;
		this.chatCharacterLimit = metadata.chatCharacterLimit;
		this.chatBannerText = metadata.chatBannerText;
		this.customEmoji = metadata.customEmoji.map(e => new Emoji(e, emojiBaseUrl));
	}

	static validate<M extends Metadatalike>(metadata: unknown): metadata is M {
		return is.object(metadata)
			&& hasTypedProperty(metadata, "width", is.number)
			&& hasTypedProperty(metadata, "height", is.number)
			&& hasTypedProperty(metadata, "palette", is.array)
			&& metadata.palette.every(PxlsColor.validate)
			&& hasTypedProperty(metadata, "heatmapCooldown", is.number)
			&& hasTypedProperty(metadata, "maxStacked", is.number)
			&& hasTypedProperty(metadata, "canvasCode", is.string)
			&& hasTypedProperty(metadata, "chatEnabled", is.boolean)
			&& hasTypedProperty(metadata, "chatCharacterLimit", is.number)
			&& hasTypedProperty(metadata, "chatBannerText", is.array)
			&& metadata.chatBannerText.every(is.string)
			&& hasTypedProperty(metadata, "customEmoji", is.array)
			&& metadata.customEmoji.every(Emoji.validate);
	}
}