import * as WS from 'ws';
import * as events from 'events';
import * as http from 'http';
import * as https from 'https';
import { ServerConfig } from './ServerConfig';
import { Socket } from './../common/Socket';

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
    readonly clients: Map<string, Socket> = new Map();

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

        const config: ServerConfig | any = {
            host: '0.0.0.0',
            port: 8080,
            maxPayload: 1024 * 1024 * 10,
            verifyClient: (info: any, cb: any) => {
                this.verifyClient(info.req, info.origin, info.secure).then(cb);
            },
            clientTracking: false,  //WS不在server.clients中保存客户端连接
        };

        if (args[0] instanceof (<any>http).Server || args[0] instanceof (<any>https).Server) {
            config.server = args[0];
        } else if (typeof args[0] === 'string') {
            config.host = args[0];
            if (typeof args[1] === 'number')
                config.port = args[1];
        } else if (typeof args[0] === 'object') {
            Object.assign(config, args[0]);
            config.maxPayload = config.maxPayload < 1024 ? 1024 : config.maxPayload;
        }

        this._ws = new WS.Server(config);
        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws.on('listening', this.emit.bind(this, 'listening'));
        this._ws.on('connection', (client) => {
            const socket = new Socket(client);
            this.onConnection(socket);
            this.clients.set(socket.id, socket);
            socket.on('close', () => {
                this.clients.delete(socket.id);
            });
        });
    }

    /**
     * 判断是否接受新的连接
     * 
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @returns {Promise<boolean>} 
     * @memberof Server
     */
    verifyClient(req: http.IncomingMessage, origin: string, secure: boolean): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * 当有新的客户端与服务器建立起连接
     * 
     * @param {Socket} socket 接口
     * @memberof Server
     */
    onConnection(socket: Socket) { }

    /**
     * 关闭服务器，并断开所有的客户端连接
     * 
     * @returns {Promise<void>} 
     * @memberof Server
     */
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._ws.close(err => {
                this.emit('close', err);
                err ? reject(err) : resolve();
            });
        });
    }

    on(event: 'error', cb: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    on(event: 'listening', cb: () => void): this
    on(event: 'close', cb: (err: Error) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }
}