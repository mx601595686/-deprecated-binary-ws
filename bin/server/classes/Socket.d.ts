/// <reference types="ws" />
/// <reference types="node" />
import * as WS from 'ws';
import { BaseSocket } from '../../BaseSocket/classes/BaseSocket';
import { ServerSocketConfig } from '../interfaces/ServerSocketConfig';
export declare class Socket extends BaseSocket {
    protected readonly _socket: WS;
    constructor(configs: ServerSocketConfig, _socket?: WS);
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
