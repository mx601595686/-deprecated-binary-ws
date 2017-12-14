import * as WS from 'ws';
import * as http from 'http';

import { BaseSocket } from '../../BaseSocket/classes/BaseSocket';
import { ServerSocketConfig } from '../interfaces/ServerSocketConfig';

export class ServerSocket extends BaseSocket {

    protected readonly _socket: WS;

    constructor(configs: ServerSocketConfig, _socket?: WS) {
        const socket = _socket || new WS(configs.url, configs);

        super(socket, configs);

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