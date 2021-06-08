/// <reference types="node" />
import { Readable } from "stream";
declare function isObject<X extends {}>(object: unknown): object is X;
declare function isArray(object: unknown): object is unknown[];
declare function hasProperty<X extends {}, Y extends PropertyKey>(object: X, property: Y): object is X & Record<Y, unknown>;
declare function pipe(stream: Readable, buffer: Uint8Array): Promise<Uint8Array>;
export { isObject, isArray, hasProperty, pipe, };
