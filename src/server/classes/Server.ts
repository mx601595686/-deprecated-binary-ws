import * as WS from 'ws';
import * as Emitter from 'component-emitter';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

import { Socket } from './Socket';
import { BaseSocketConfig } from '../../BaseSocket/interfaces/BaseSocketConfig';

export class Server extends Emitter {

    private readonly _http: http.Server | https.Server;

    private readonly _ws: WS.Server;

    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, Socket> = new Map();

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
            maxPayload: configs.maxPayload == null || configs.maxPayload <= 0 ? undefined : configs.maxPayload + 1024, //多加1kb是为内部信息一部分空间
            path: configs.url && (new URL(configs.url)).pathname,
            verifyClient: (info, cb) => {   //连接验证
                this.verifyClient(info.req, info.origin, info.secure)
                    .then((result => typeof result === 'boolean' ? cb(result) : cb(result.res, result.code, result.message)))
                    .catch((err) => { cb(false); console.error('binary-ws 客户端连接验证出现异常', err); });
            }
        });

        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws.once('listening', this.emit.bind(this, 'listening'));

        this._ws.on('connection', client => {
            const socket = new Socket(configs, client);
            this.clients.set(socket.id, socket);

            socket.once('close', () => this.clients.delete(socket.id));
            socket.once('error', () => socket.close()); //接口如果出现异常则关闭

            this.emit('connection', socket);
        });
    }

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
    protected verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean | { res: boolean, code?: number, message?: string }> {
        return Promise.resolve(true);
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
     * 当有新的客户端与服务器建立起连接
     */
    on(event: 'connection', listener: (socket: Socket) => void): this
    on(event: 'close', listener: (err: Error) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    once(event: 'error', listener: (err: Error) => void): this
    once(event: 'listening', listener: () => void): this
    once(event: 'connection', listener: (socket: Socket) => void): this
    once(event: 'close', listener: (err: Error) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}