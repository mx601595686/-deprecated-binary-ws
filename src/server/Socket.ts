import * as WS from 'ws';

import { ServerSocketConfig } from './ServerSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
import { ReadyState } from "../common/ReadyState";

export class Socket extends BaseSocket {

    /**
     * 每新建一个接口+1
     * 
     * @private
     * @static
     * @memberof Socket
     */
    private static _id_Number = 0;

    /**
     * 当前接口的id
     * 
     * @memberof Socket
     */
    readonly id: number;

    readonly socket: WS;

    get readyState(): ReadyState {
        return this.socket.readyState as any;
    }

    get bufferedAmount(): number {
        return this.socket.bufferedAmount;
    }

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
        let socket: WS;

        if (args instanceof WS) {   //服务器内部创建的接口
            socket = args;
        } else {
            if (typeof args === 'string') {
                cf.url = args;
            } else if (typeof args === 'object') {
                Object.assign(cf, args);
            }
            
            socket = new WS(cf.url, cf);
        }

        socket.on('open', () => this.emit('open'));
        socket.on('close', () => this.emit('close'));
        socket.on('error', (err) => this.emit('error', err));
        socket.on('message', (data: Buffer) => this._receiveData(data));

        super(socket, 'node', cf);
        this.id = Socket._id_Number++;
    }

    protected _sendData(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(data, { binary: true }, (err) => {
                err ? reject(err) : resolve();
            });
        });
    }

    close(): void {
        this.socket.close();
    }
}