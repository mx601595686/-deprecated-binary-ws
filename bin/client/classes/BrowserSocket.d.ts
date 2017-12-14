/// <reference types="node" />
import { BaseSocket } from "../../BaseSocket/classes/BaseSocket";
import { BaseSocketConfig } from "../../BaseSocket/interfaces/BaseSocketConfig";
export declare class BrowserSocket extends BaseSocket {
    protected readonly _socket: WebSocket;
    constructor(configs?: BaseSocketConfig);
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
