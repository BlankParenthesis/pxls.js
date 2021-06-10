/// <reference types="node" />
import { Readable } from "stream";
export declare function isObject<X extends {}>(object: unknown): object is X;
export declare function isArray(object: unknown): object is unknown[];
export declare function hasProperty<X extends {}, Y extends PropertyKey>(object: X, property: Y): object is X & Record<Y, unknown>;
export declare function pipe(stream: Readable, buffer: Uint8Array): Promise<Uint8Array>;
export declare class ValidationError extends Error {
    readonly object: unknown;
    constructor(object: unknown, objectName: string);
}
