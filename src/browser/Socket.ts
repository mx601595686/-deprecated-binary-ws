import { NodeBuffer, nodeBufferToArraybuffer } from 'object2buffer';

import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
import { ReadyState } from "../common/ReadyState";

export class Socket extends BaseSocket {

    readonly _socket: WebSocket;

    /**
     * @param {string} [url] 服务器地址，如果不指定，默认连接的是当前域名下的根
     */
    constructor(url?: string)
    /**
     * @param  {BaseSocketConfig} [configs] 端口的配置
     */
    constructor(configs?: BaseSocketConfig)
    constructor(args?: any) {
        const cf: BaseSocketConfig = {
            url: `ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`
        }

        if (typeof args === 'string') {
            cf.url = args;
        } else if (typeof args === 'object') {
            Object.assign(cf, args);
        }

        if (!(cf.socket instanceof WebSocket))
            cf.socket = new WebSocket(cf.url);

        (<WebSocket>(cf.socket)).binaryType = 'arraybuffer';
        (<WebSocket>(cf.socket)).onopen = () => this.emit('open');
        (<WebSocket>(cf.socket)).onclose = (ev) => this.emit('close', ev.code, ev.reason);
        (<WebSocket>(cf.socket)).onerror = (err) => { console.error(err), this.emit('error', new Error('连接错误')); }
        (<WebSocket>(cf.socket)).onmessage = (e) => this._receiveData(NodeBuffer.from(e.data));

        super(cf);
    }

    protected _sendData(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this._socket.send(nodeBufferToArraybuffer(data));  //不可以直接发送buffer

            const check = (interval: number) => {
                setTimeout(() => {
                    if (this._socket.bufferedAmount === 0) {
                        resolve();
                    } else {
                        check(interval >= 2000 ? 2000 : interval * 2); //最慢2秒检查一次
                    }
                }, interval);
            }

            check(1);
        });
    }

    close() {
        this._socket.close();
    }
}
