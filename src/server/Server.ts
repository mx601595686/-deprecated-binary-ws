import * as WS from 'ws';
import * as events from 'events';
import * as http from 'http';
import * as https from 'https';
import { ServerConfig } from './ServerConfig';
import { Socket } from './Socket';

export class Server extends events.EventEmitter {

    /**
     * 被包装的websocket对象
     * 
     * @type {WS.Server}
     * @memberof Server
     */
    readonly _ws: WS.Server;

    /**
     * 保存所有客户端连接。key是socket.id
     */
    readonly clients: Map<number, Socket> = new Map();

    /**
     * 创建websocket服务器。
     * @memberof Server
     */
    constructor()
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的地址
     * @memberof Server
     */
    constructor(host: string)
    /**
     * 创建websocket服务器。
     * @param {string} port 监听的端口
     * @memberof Server
     */
    constructor(port: number)
    /**
     * 创建websocket服务器。
     * @param {string} host 监听的地址
     * @param {number} port 监听的端口
     * @memberof Server
     */
    constructor(host: string, port: number)
    /**
     * 创建websocket服务器。
     * @param {(http.Server | https.Server)} server 绑定到这个http服务器之上
     * @memberof Server
     */
    constructor(server: http.Server | https.Server)
    /**
     * 创建websocket服务器。
     * @param {ServerConfig} options 服务器配置
     * @memberof Server
     */
    constructor(options: ServerConfig)
    constructor(...args: any[]) {
        super();

        const config: ServerConfig & { verifyClient: WS.VerifyClientCallbackAsync } = {
            host: '0.0.0.0',
            port: 8080,
            verifyClient: (info, cb) => {
                this.verifyClient(info.req, info.origin, info.secure).then((result => {
                    if (typeof result === 'boolean') {
                        cb(result);
                    } else {
                        cb(result.res, result.code, result.message);
                    }
                }));
            }
        };

        if (args[0] instanceof (<any>http).Server || args[0] instanceof (<any>https).Server) {
            config.server = args[0];
            config.host = undefined;    //必须清除，否则WS内部会另外创建一个http server
            config.port = undefined;
        } else if (typeof args[0] === 'number') {
            config.port = args[0];
        } else if (typeof args[0] === 'string') {
            config.host = args[0];
            if (typeof args[1] === 'number')
                config.port = args[1];
        } else if (typeof args[0] === 'object') {
            Object.assign(config, args[0]);
        }

        this._ws = new WS.Server(config);
        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws.on('listening', this.emit.bind(this, 'listening'));
        this._ws.on('connection', (client) => {
            const socket = new Socket(client);
            this.clients.set(socket.id, socket);
            this.emit('connection', socket);

            socket.on('close', () => {
                this.clients.delete(socket.id);
            });
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
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @returns {Promise<boolean | { res: boolean, code?: number, message?: string }>} 
     * @memberof Server
     */
    verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean | { res: boolean, code?: number, message?: string }> {
        return Promise.resolve(true);
    }

    /**
     * 关闭服务器，并断开所有的客户端连接
     * 
     * @returns {void} 
     * @memberof Server
     */
    close() {
        this._ws.close(err => {
            this.emit('close', err);
        });
    }

    on(event: 'error', cb: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    on(event: 'listening', cb: () => void): this
    /**
     * 当有新的客户端与服务器建立起连接
     */
    on(event: 'connection', cb: (socket: Socket) => void): this
    on(event: 'close', cb: (err: Error) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    addListener(event: 'error', cb: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    addListener(event: 'listening', cb: () => void): this
    /**
     * 当有新的客户端与服务器建立起连接
     */
    addListener(event: 'connection', cb: (socket: Socket) => void): this
    addListener(event: 'close', cb: (err: Error) => void): this
    addListener(event: string, listener: Function): this {
        super.addListener(event, listener);
        return this;
    }

    once(event: 'error', cb: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    once(event: 'listening', cb: () => void): this
    /**
     * 当有新的客户端与服务器建立起连接
     */
    once(event: 'connection', cb: (socket: Socket) => void): this
    once(event: 'close', cb: (err: Error) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}