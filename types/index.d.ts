/// <reference types="node" />
import * as EventEmitter from "events";
import { Message, Pixel, PixelsMessage, UsersMessage, AlertMessage, Notification, NotificationMessage, ChatMessage, ChatMessageMessage } from "./messages";
import { PxlsColor, Emoji, Metadata } from "./metadata";
export { Message, Pixel, PixelsMessage, UsersMessage, AlertMessage, Notification, NotificationMessage, ChatMessage, ChatMessageMessage, PxlsColor, Emoji, Metadata, };
export declare const TRANSPARENT_PIXEL = 255;
export interface SyncData {
    metadata: Metadata;
    canvas?: Uint8Array;
    heatmap?: Uint8Array;
    placemap?: Uint8Array;
    virginmap?: Uint8Array;
}
export interface Pxls {
    on(event: "ready", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "pixel", listener: (pixel: Pixel & {
        oldColor?: number;
    }) => void): this;
    on(event: "users", listener: (users: number) => void): this;
    on(event: "sync", listener: (data: SyncData) => void): this;
    on(event: "alert", listener: (alert: AlertMessage) => void): this;
    on(event: "notification", listener: (notification: Notification) => void): this;
    on(event: "chatmessage", listener: (message: ChatMessage) => void): this;
    emit(event: "ready"): boolean;
    emit(event: "error", error: Error): boolean;
    emit(event: "disconnect"): boolean;
    emit(event: "pixel", pixel: Pixel & {
        oldColor?: number;
    }): boolean;
    emit(event: "users", users: number): boolean;
    emit(event: "sync", data: SyncData): boolean;
    emit(event: "alert", notification: AlertMessage): boolean;
    emit(event: "notification", notification: Notification): boolean;
    emit(event: "chatmessage", message: ChatMessage): boolean;
}
export declare enum BufferType {
    CANVAS = 0,
    HEATMAP = 1,
    PLACEMAP = 2,
    VIRGINMAP = 3,
    INITIAL_CANVAS = 4
}
export interface CooldownOptions {
    globalOffset: number;
    userOffset: number;
    steepness: number;
    multiplier: number;
}
export interface PxlsOptions {
    site?: string;
    buffers?: ArrayLike<BufferType>;
    cooldownConfig?: CooldownOptions;
}
export declare class Pxls extends EventEmitter {
    readonly site: string;
    private disconnected;
    private synced;
    private readonly pixelBuffer;
    private wsVariable?;
    private metadata?;
    private userCount?;
    private readonly bufferRestriction;
    private canvasdata?;
    private heatmapdata?;
    private placemapdata?;
    private virginmapdata?;
    private initialcanvasdata?;
    readonly notifications: Notification[];
    private readonly notificationBuffer;
    private wsHeartbeat?;
    private heatmapCooldownInterval?;
    private cooldownConfig;
    constructor(optionsOrSite?: string | PxlsOptions);
    private get ws();
    connect(): Promise<void>;
    private processPixel;
    private connectWS;
    disconnect(): Promise<void>;
    private setMetadata;
    private get bufferSources();
    sync(): Promise<void>;
    save(file: string): Promise<void>;
    private saveBufferColor;
    saveCanvas(file: string): Promise<void>;
    saveInitialCanvas(file: string): Promise<void>;
    private saveBufferBW;
    saveHeatmap(file: string): Promise<void>;
    savePlacemap(file: string): Promise<void>;
    saveVirginmap(file: string): Promise<void>;
    address(x: number, y: number): number;
    get users(): number;
    get width(): number;
    get height(): number;
    get palette(): PxlsColor[];
    get heatmapCooldown(): number;
    get maxStacked(): number;
    get canvasCode(): string;
    get chatEnabled(): boolean;
    get chatCharacterLimit(): number;
    get chatBannerText(): string[];
    get customEmoji(): Emoji[];
    get canvas(): Uint8Array;
    get heatmap(): Uint8Array;
    get virginmap(): Uint8Array;
    get placemap(): Uint8Array;
    get initialcanvas(): Uint8Array;
    private static cropBuffer;
    cropCanvas(x: number, y: number, width: number, height: number): Uint8Array;
    cropHeatmap(x: number, y: number, width: number, height: number): Uint8Array;
    cropPlacemap(x: number, y: number, width: number, height: number): Uint8Array;
    cropVirginmap(x: number, y: number, width: number, height: number): Uint8Array;
    getCroppedCanvas(x: number, y: number, width: number, height: number): Uint8Array;
    static convertBufferToRGBA(buffer: Uint8Array, palette: PxlsColor[]): Uint8Array;
    get rgba(): Uint8Array;
    static cooldownForUserCount(users: number, config?: CooldownOptions): number;
    get currentCooldown(): number;
    static cooldownForUserCountAndStackCount(users: number, availablePixels: number, config?: CooldownOptions): number;
    currentCooldownForStackCount(availablePixels: number): number;
}
export default Pxls;
