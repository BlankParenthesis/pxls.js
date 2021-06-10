export interface Message {
    type: string;
}
export declare class Message {
    static validate<M extends Message>(message: unknown): message is M;
}
export interface Pixel {
    x: number;
    y: number;
    color: number;
}
export declare class Pixel {
    static validate<P extends Pixel>(pixel: unknown): pixel is P;
}
export interface PixelsMessage extends Message {
    type: "pixels";
    pixels: Pixel[];
}
export declare class PixelsMessage {
    static validate<M extends PixelsMessage>(message: Message): message is M;
}
export interface UsersMessage extends Message {
    type: "users";
    count: number;
}
export declare class UsersMessage {
    static validate<M extends UsersMessage>(message: Message): message is M;
}
export interface AlertMessage extends Message {
    sender: string;
    message: string;
}
export declare class AlertMessage {
    static validate<M extends AlertMessage>(message: Message): message is M;
}
export interface Notification {
    id: number;
    time: number;
    expiry?: number;
    who: string;
    title: string;
    content: string;
}
export declare class Notification {
    static validate<M extends Notification>(notification: unknown): notification is M;
}
export interface NotificationMessage extends Message {
    notification: Notification;
}
export declare class NotificationMessage {
    static validate<M extends NotificationMessage>(message: Message): message is M;
}
export interface Purge {
    initiator: string;
    reason: string;
}
export declare class Purge {
    static validate<M extends Purge>(purge: unknown): purge is M;
}
export interface Badge {
    displayName: string;
    tooltip: string;
    type: string;
    cssIcon?: string;
}
export declare class Badge {
    static validate<M extends Badge>(badge: unknown): badge is M;
}
export interface StrippedFaction {
    id: number;
    name: string;
    tag?: string;
    color: number;
}
export declare class StrippedFaction {
    static validate<M extends StrippedFaction>(faction: unknown): faction is M;
}
export interface ChatMessage {
    id: number;
    author: string;
    date: number;
    message_raw: string;
    purge?: Purge;
    badges: Badge[];
    authorNameColor: number;
    authorWasShadowBanned?: boolean;
    strippedFaction?: StrippedFaction;
}
export declare class ChatMessage {
    static validate<M extends ChatMessage>(notification: unknown): notification is M;
}
export interface ChatMessageMessage extends Message {
    message: ChatMessage;
}
export declare class ChatMessageMessage {
    static validate<M extends ChatMessageMessage>(message: Message): message is M;
}
