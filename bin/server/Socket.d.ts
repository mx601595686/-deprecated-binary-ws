/// <reference types="ws" />
/// <reference types="node" />
import * as WS from 'ws';
import { ServerSocketConfig } from './ServerSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
export declare class Socket extends BaseSocket {
    /**
     * 每新建一个接口+1
     */
    private static _id_Number;
    /**
     * 当前接口的id
     */
    readonly id: number;
    readonly _socket: WS;
    /**
     * @param {string} url 服务器地址
     */
    constructor(url: string);
    /**
     * @param configs 端口的配置
     */
    constructor(configs: ServerSocketConfig);
    protected _sendData(data: Buffer): Promise<void>;
    close(): void;
}
