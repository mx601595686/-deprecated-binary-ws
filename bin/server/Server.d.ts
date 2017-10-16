/// <reference types="ws" />
/// <reference types="node" />
import * as WS from 'ws';
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { ServerConfig } from './ServerConfig';
import { Socket } from './Socket';
export declare class Server extends Emitter {
    /**
     * 被包装的websocket对象
     */
    readonly ws: WS.Server;
    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, Socket>;
    /**
     * 创建websocket服务器。
     */
    constructor();
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的主机地址
     */
    constructor(host: string);
    /**
     * 创建websocket服务器。
     * @param {string} port 监听的端口
     */
    constructor(port: number);
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的主机地址
     * @param {number} port 监听的端口
     */
    constructor(host: string, port: number);
    /**
     * 创建websocket服务器。
     * @param {(http.Server | https.Server)} server 绑定到指定的http服务器之上
     */
    constructor(server: http.Server | https.Server);
    /**
     * 创建websocket服务器。
     * @param {ServerConfig} options 服务器配置
     */
    constructor(options: ServerConfig);
    /**
     * 判断是否接受新的连接。
     * 返回true表示接受，返回false表示拒绝。也可以返回一个对象，提供更多信息。
     *
     * 返回对象：
     *      res {Boolean} Whether or not to accept the handshake.
     *      code {Number} When result is false this field determines the HTTP error status code to be sent to the client.
     *      name {String} When result is false this field determines the HTTP reason phrase.
     *
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @returns {Promise<boolean | { res: boolean, code?: number, message?: string }>}
     */
    verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean | {
        res: boolean;
        code?: number;
        message?: string;
    }>;
    /**
     * 关闭服务器，并断开所有的客户端连接
     */
    close(): void;
    on(event: 'error', listener: (err: Error) => void): this;
    /**
     * 当服务器开始监听
     */
    on(event: 'listening', listener: () => void): this;
    /**
     * 当有新的客户端与服务器建立起连接
     */
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: 'close', listener: (err: Error) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'listening', listener: () => void): this;
    once(event: 'connection', listener: (socket: Socket) => void): this;
    once(event: 'close', listener: (err: Error) => void): this;
}
