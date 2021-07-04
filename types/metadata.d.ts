/// <reference types="node" />
import { URL } from "url";
export interface PxlsColorlike {
    name: string;
    value: string;
}
export declare class PxlsColor {
    readonly name: string;
    readonly values: [number, number, number];
    constructor(object: PxlsColorlike);
    static validate<C extends PxlsColorlike>(color: unknown): color is C;
}
export interface Emojilike {
    name: string;
    emoji: string;
}
export declare class Emoji {
    readonly name: string;
    readonly url: URL;
    constructor(emoji: Emojilike, base: URL);
    static validate<E extends Emojilike>(emoji: unknown): emoji is E;
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
export declare class Metadata {
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
    constructor(metadata: Metadatalike, site: string);
    static validate<M extends Metadatalike>(metadata: unknown): metadata is M;
}
