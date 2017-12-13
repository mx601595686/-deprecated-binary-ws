import * as WS from 'ws';
import * as http from 'http';

import { BaseSocket } from '../../BaseSocket/classes/BaseSocket';
import { ServerSocketConfig } from '../interfaces/ServerSocketConfig';

export class Socket extends BaseSocket {

    protected readonly _socket: WS;

    /**
     * 客户端与服务器建立连接时，传递的http header。这个属性只有服务器端才有
     */
    readonly headers: any;

    constructor(configs: ServerSocketConfig, _socket?: WS, _req?: http.IncomingMessage) {
        const socket = _socket || new WS(configs.url, configs);

        super(socket, configs);

        if (_req) this.headers = _req.headers; else this.headers = {};

        this._socket.on('open', this.emit.bind(this, 'open'));
        this._socket.on('close', this.emit.bind(this, 'close'));
        this._socket.on('error', this.emit.bind(this, 'error'));
        this._socket.on('message', this._receiveData.bind(this));
    }

    protected _sendData(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this._socket.send(data, { binary: true }, (err) => {
                err ? reject(err) : resolve();
            });
        });
    }

    close(): void {
        this._socket.close();
    }
}