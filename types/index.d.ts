/// <reference types="node" />
import * as EventEmitter from "events";
import * as WebSocket from "ws";
import { PNG } from "pngjs";
import { Pixel } from "./messages";
declare class PxlsColor {
    readonly name: string;
    readonly values: [number, number, number];
    constructor(object: unknown);
}
interface Metadata {
    width: number;
    height: number;
    palette: PxlsColor[];
    heatmapCooldown: number;
    maxStacked: number;
    canvasCode: string;
}
interface SyncData {
    metadata: Metadata;
    canvas: Uint8Array;
    heatmap: Uint8Array;
    placemap: Uint8Array;
    virginmap: Uint8Array;
}
declare interface Pxls {
    on(event: "ready", listener: () => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "pixel", listener: (pixel: Pixel & {
        oldColor: number;
    }) => void): this;
    on(event: "users", listener: (users: number) => void): this;
    on(event: "sync", listener: (data: SyncData) => void): this;
    emit(event: "ready"): boolean;
    emit(event: "disconnect"): boolean;
    emit(event: "pixel", pixel: Pixel & {
        oldColor: number;
    }): boolean;
    emit(event: "users", users: number): boolean;
    emit(event: "sync", data: SyncData): boolean;
}
declare class Pxls extends EventEmitter {
    readonly site: string;
    private synced;
    private wsVariable?;
    private metadata?;
    private userCount?;
    private canvasdata?;
    private heatmapdata?;
    private placemapdata?;
    private virginmapdata?;
    private heartbeatTimeout?;
    constructor(site?: string);
    get ws(): WebSocket;
    connect(): Promise<Uint8Array>;
    private connectWS;
    restartWS(): Promise<void>;
    closeWS(): Promise<void>;
    private setMetadata;
    private setupListeners;
    private pipe;
    sync(): Promise<void>;
    private static savePng;
    /**
     * @alias saveCanvas
     */
    save(file: string): Promise<void>;
    saveCanvas(file: string): Promise<void>;
    saveHeatmap(file: string): Promise<void>;
    savePlacemap(file: string): Promise<void>;
    saveVirginmap(file: string): Promise<void>;
    private static pngFromGrayscaleBuffer;
    get png(): PNG;
    get heatmapPng(): PNG;
    get placemapPng(): PNG;
    get virginmapPng(): PNG;
    address(x: number, y: number): number;
    get users(): number;
    get width(): number;
    get height(): number;
    get palette(): PxlsColor[];
    get heatmapCooldown(): number;
    get maxStacked(): number;
    get canvasCode(): string;
    get canvas(): Uint8Array;
    get heatmap(): Uint8Array;
    get virginmap(): Uint8Array;
    get placemap(): Uint8Array;
    private cropBuffer;
    cropCanvas(x: number, y: number, width: number, height: number): Uint8Array;
    cropHeatmap(x: number, y: number, width: number, height: number): Uint8Array;
    cropPlacemap(x: number, y: number, width: number, height: number): Uint8Array;
    cropVirginmap(x: number, y: number, width: number, height: number): Uint8Array;
    /**
     * @deprecated use `cropCanvas` instead
     */
    getCroppedCanvas(x: number, y: number, width: number, height: number): Uint8Array;
    private convertBufferToRGBA;
    get rgba(): Uint8Array;
}
export = Pxls;
