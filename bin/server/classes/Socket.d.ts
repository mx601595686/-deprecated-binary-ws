/// <reference types="ws" />
/// <reference types="node" />
import * as WS from 'ws';
import * as http from 'http';
import { BaseSocket } from '../../BaseSocket/classes/BaseSocket';
import { ServerSocketConfig } from '../interfaces/ServerSocketConfig';
export declare class Socket extends BaseSocket {
    protected readonly _socket: WS;
    /**
     * 客户端与服务器建立连接时，传递的http header。这个属性只有服务器端才有
     */
    readonly headers: any;
    constructor(configs: ServerSocketConfig, _socket?: WS, _req?: http.IncomingMessage);
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
