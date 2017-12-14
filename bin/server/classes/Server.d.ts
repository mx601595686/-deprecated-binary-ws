/// <reference types="node" />
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { ServerSocket } from './ServerSocket';
import { BaseSocketConfig } from '../../BaseSocket/interfaces/BaseSocketConfig';
export declare class Server extends Emitter {
    private readonly _http;
    private readonly _ws;
    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, ServerSocket>;
    /**
     * 创建binary-ws Server。
     * @param server 要绑定的http服务器
     * @param configs 接口配置
     */
    constructor(server: http.Server | https.Server, configs: BaseSocketConfig);
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
     * 当有新的客户端与服务器建立起连接时触发。
     * req为客户端向服务器建立连接时发送的get请求，可通过这个进行一些用户验证。
     * 注意：如果用户未通过验证，记得执行socket.close()，服务器并不会自动断开连接。
     */
    on(event: 'connection', listener: (socket: ServerSocket, req: http.IncomingMessage) => void): this;
    on(event: 'close', listener: (err: Error) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'listening', listener: () => void): this;
    once(event: 'connection', listener: (socket: ServerSocket, req: http.IncomingMessage) => void): this;
    once(event: 'close', listener: (err: Error) => void): this;
}
