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

        if (typeof args === 'string') {
            cf.url = args;
        } else if (typeof args === 'object') {
            Object.assign(cf, args);
        }

        if (!(cf.socket instanceof WS))
            cf.socket = new WS(cf.url, cf);

        (<WS>(cf.socket)).on('open', () => this.emit('open'));
        (<WS>(cf.socket)).on('close', (code: number, reason: string) => this.emit('close', code, reason));
        (<WS>(cf.socket)).on('error', (err) => this.emit('error', err));
        (<WS>(cf.socket)).on('message', (data: Buffer) => this._receiveData(data));

        super('node', cf);
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