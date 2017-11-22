/// <reference types="node" />
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { Socket } from './Socket';
import { BaseSocketConfig } from '../../BaseSocket/interfaces/BaseSocketConfig';
export declare class Server extends Emitter {
    private readonly _http;
    private readonly _ws;
    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, Socket>;
    /**
     * 创建binary-ws Server。
     * @param server 要绑定的http服务器
     * @param configs 接口配置
     */
    constructor(server: http.Server | https.Server, configs: BaseSocketConfig);
    /**
     * 判断是否接受新的连接。
     * 返回true表示接受，返回false表示拒绝。也可以返回一个对象，提供更多信息。
     *
     * 返回对象：
     *      res {Boolean} Whether or not to accept the handshake.
     *      code {Number} When result is false this field determines the HTTP error status code to be sent to the client.
     *      name {String} When result is false this field determines the HTTP reason phrase.
     *
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @returns {Promise<boolean | { res: boolean, code?: number, message?: string }>}
     */
    protected verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean | {
        res: boolean;
        code?: number;
        message?: string;
    }>;
    /**
     * 关闭服务器，并断开所有的客户端连接。（注意这个会将绑定的http server也关了）
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
