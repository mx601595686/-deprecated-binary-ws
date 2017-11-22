import * as WS from 'ws';
import { BaseSocket } from '../../BaseSocket/classes/BaseSocket';
import { ServerSocketConfig } from '../interfaces/ServerSocketConfig';


export class Socket extends BaseSocket {



    readonly _socket: WS;

    /**
     * @param {string} url 服务器地址
     */
    constructor(url: string)
    /**
     * @param configs 端口的配置
     */
    constructor(configs: ServerSocketConfig)
    constructor(args: any) {
        const cf: ServerSocketConfig = { url: '' };

        if (typeof args === 'string') {
            cf.url = args;
        } else if (typeof args === 'object') {
            Object.assign(cf, args);
        } else {
            throw new Error('传入的参数类型不正确');
        }

        if (!(cf.socket instanceof WS)) //如果没有直接传入接口，则创建一个
            cf.socket = new WS(cf.url, cf);

        super(cf);

        this._socket.on('open', this.emit.bind(this, 'open'));
        this._socket.on('close', this.emit.bind(this, 'close'));
        this._socket.on('error', this.emit.bind(this, 'error'));
        this._socket.on('message', (data: Buffer) => this._receiveData(data));


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