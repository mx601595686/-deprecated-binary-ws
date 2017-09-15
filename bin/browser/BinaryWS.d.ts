/// <reference types="node" />
import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
export default class BinaryWS extends BaseSocket {
    readonly socket: WebSocket;
    /**
     * @param {string} url 服务器地址，如果不指定，默认连接的是当前域名下的根
     */
    constructor(url: string);
    /**
     * @param configs 端口的配置
     */
    constructor(configs: BaseSocketConfig);
    send(messageName: string, data?: any[], needACK?: boolean): Promise<number>;
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
