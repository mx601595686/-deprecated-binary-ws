/// <reference types="ws" />
/// <reference types="node" />
import * as WS from 'ws';
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { ServerConfig } from './ServerConfig';
import { Socket } from './../common/Socket';
export declare class Server extends Emitter {
    /**
     * 原始的websocket对象
     *
     * @type {WS.Server}
     * @memberof Server
     */
    readonly _ws: WS.Server;
    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<string, Socket>;
    /**
     * 创建websocket服务器。
     * @memberof Server
     */
    constructor();
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的地址
     * @memberof Server
     */
    constructor(host: string);
    /**
     * 创建websocket服务器。
     * @param {string} port 监听的端口
     * @memberof Server
     */
    constructor(port: number);
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的地址
     * @param {number} port 监听的端口
     * @memberof Server
     */
    constructor(host: string, port: number);
    /**
     * 创建websocket服务器。
     * @param {(http.Server | https.Server)} server 绑定到这个http服务器之上
     * @memberof Server
     */
    constructor(server: http.Server | https.Server);
    /**
     * 创建websocket服务器。
     * @param {ServerConfig} options 服务器配置
     * @memberof Server
     */
    constructor(options: ServerConfig);
    /**
     * 判断是否接受新的连接
     *
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @returns {Promise<boolean>}
     * @memberof Server
     */
    verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean>;
    /**
     * 当有新的客户端与服务器建立起连接
     *
     * @param {Socket} socket 接口
     * @memberof Server
     */
    onConnection(socket: Socket): void;
    /**
     * 关闭服务器，并断开所有的客户端连接
     *
     * @returns {Promise<void>}
     * @memberof Server
     */
    close(): Promise<void>;
    on(event: 'error', cb: (err: Error) => void): this;
    /**
     * 当服务器开始监听
     */
    on(event: 'listening', cb: () => void): this;
    on(event: 'close', cb: (err: Error) => void): this;
}
