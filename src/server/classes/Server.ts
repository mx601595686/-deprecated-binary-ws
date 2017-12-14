import * as WS from 'ws';
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

import { ServerSocket } from './ServerSocket';
import { BaseSocketConfig } from '../../BaseSocket/interfaces/BaseSocketConfig';

export class Server extends Emitter {

    private readonly _http: http.Server | https.Server;

    private readonly _ws: WS.Server;

    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, ServerSocket> = new Map();

    /**
     * 创建binary-ws Server。
     * @param server 要绑定的http服务器
     * @param configs 接口配置
     */
    constructor(server: http.Server | https.Server, configs: BaseSocketConfig) {
        super();

        this._http = server;
        this._http.once('close', this.emit.bind(this, 'close'));

        this._ws = new WS.Server({
            server,
            maxPayload: configs.maxPayload == null || configs.maxPayload <= 0 ? undefined : configs.maxPayload + 4, //多加4是因为title长度还会占一部分控件
            path: (new URL(configs.url)).pathname
        });

        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws.once('listening', this.emit.bind(this, 'listening'));

        this._ws.on('connection', (client, req) => {
            const socket = new ServerSocket(configs, client);
            this.clients.set(socket.id, socket);

            socket.once('close', () => this.clients.delete(socket.id));
            socket.once('error', () => socket.close()); //接口如果出现异常则关闭

            this.emit('connection', socket, req);
        });
    }

    /**
     * 关闭服务器，并断开所有的客户端连接。（注意这个会将绑定的http server也关了）
     */
    close() {
        this._ws.close();
        this._http.close(); //_ws不会把绑定的server关掉
    }

    on(event: 'error', listener: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    on(event: 'listening', listener: () => void): this
    /**
     * 当有新的客户端与服务器建立起连接时触发。    
     * req为客户端向服务器建立连接时发送的get请求，可通过这个进行一些用户验证。     
     * 注意：如果用户未通过验证，记得执行socket.close()，服务器并不会自动断开连接。     
     */
    on(event: 'connection', listener: (socket: ServerSocket, req: http.IncomingMessage) => void): this
    on(event: 'close', listener: (err: Error) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    once(event: 'error', listener: (err: Error) => void): this
    once(event: 'listening', listener: () => void): this
    once(event: 'connection', listener: (socket: ServerSocket, req: http.IncomingMessage) => void): this
    once(event: 'close', listener: (err: Error) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}