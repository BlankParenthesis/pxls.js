/// <reference types="node" />
export declare const isObject: <X extends {}>(object: unknown) => object is X;
export declare const isArray: (object: unknown) => object is unknown[];
export declare const hasProperty: <X extends {}, Y extends PropertyKey>(object: X, property: Y) => object is X & Record<Y, unknown>;
export declare const pipe: (stream: NodeJS.ReadableStream, buffer: Uint8Array) => Promise<Uint8Array>;
export declare class ValidationError extends Error {
    readonly object: unknown;
    constructor(object: unknown, objectName: string);
}
export declare const range: (start: number, end: number) => number[];
export declare const sum: (total: number, next: number) => number;
export declare const wait: (t: number) => Promise<unknown>;
export declare const doWithTimeout: <X>(action: () => Promise<X>, timeout: number) => Promise<X>;
