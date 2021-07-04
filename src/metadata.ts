import { URL } from "url";

import color = require("color-parse");
import * as should from "should";

import { isObject, hasProperty } from "./util";

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
		return isObject(color)
			&& hasProperty(color, "name")
			&& typeof color.name === "string"
			&& hasProperty(color, "value")
			&& typeof color.value === "string";
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
		return isObject(emoji)
			&& hasProperty(emoji, "name")
			&& typeof emoji.name === "string"
			&& hasProperty(emoji, "emoji")
			&& typeof emoji.emoji === "string";
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
		return isObject(metadata)
			&& hasProperty(metadata, "width")
			&& typeof metadata.width === "number"
			&& hasProperty(metadata, "height")
			&& typeof metadata.height === "number"
			&& hasProperty(metadata, "palette")
			&& Array.isArray(metadata.palette)
			&& metadata.palette.every(c => PxlsColor.validate(c))
			&& hasProperty(metadata, "heatmapCooldown")
			&& typeof metadata.heatmapCooldown === "number"
			&& hasProperty(metadata, "maxStacked")
			&& typeof metadata.maxStacked === "number"
			&& hasProperty(metadata, "canvasCode")
			&& typeof metadata.canvasCode === "string"
			&& hasProperty(metadata, "chatEnabled")
			&& typeof metadata.chatEnabled === "boolean"
			&& hasProperty(metadata, "chatCharacterLimit")
			&& typeof metadata.chatCharacterLimit === "number"
			&& hasProperty(metadata, "chatBannerText")
			&& Array.isArray(metadata.chatBannerText)
			&& metadata.chatBannerText.every(t => typeof t === "string")
			&& hasProperty(metadata, "customEmoji")
			&& Array.isArray(metadata.customEmoji)
			&& metadata.customEmoji.every(e => Emoji.validate(e));
	}
}