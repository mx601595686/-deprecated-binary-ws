/// <reference types="node" />
import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
export declare class Socket extends BaseSocket {
    readonly _socket: WebSocket;
    /**
     * @param {string} [url] 服务器地址，如果不指定，默认连接的是当前域名下的根
     */
    constructor(url?: string);
    /**
     * @param  {BaseSocketConfig} [configs] 端口的配置
     */
    constructor(configs?: BaseSocketConfig);
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
