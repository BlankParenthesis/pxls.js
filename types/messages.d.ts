interface Message {
    type: string;
}
declare class Message {
    static validate<M extends Message>(message: unknown): message is M;
}
interface Pixel {
    x: number;
    y: number;
    color: number;
}
declare class Pixel {
    static validate<P extends Pixel>(pixel: unknown): pixel is P;
}
interface PixelsMessage extends Message {
    type: "pixels";
    pixels: Pixel[];
}
declare class PixelsMessage {
    static validate<M extends PixelsMessage>(message: Message): message is M;
}
interface UsersMessage extends Message {
    type: "users";
    count: number;
}
declare class UsersMessage {
    static validate<M extends UsersMessage>(message: Message): message is M;
}
export { Message, Pixel, PixelsMessage, UsersMessage, };
