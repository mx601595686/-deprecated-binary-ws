const toArrayBuffer = require('to-arraybuffer');

import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
import { ReadyState } from "../common/ReadyState";

export default class BinaryWS extends BaseSocket {

    readonly socket: WebSocket;

    /**
     * @param {string} url 服务器地址，如果不指定，默认连接的是当前域名下的根
     */
    constructor(url: string)
    /**
     * @param configs 端口的配置
     */
    constructor(configs: BaseSocketConfig)
    constructor(args?: any) {
        const cf: BaseSocketConfig = {
            url: `ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`
        }

        if (typeof args === 'string') {
            cf.url = args;
        } else if (typeof args === 'object') {
            Object.assign(cf, args);
        }

        const socket = new WebSocket(cf.url);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => this.emit('open');
        socket.onclose = (ev) => this.emit('close', ev.code, ev.reason);
        socket.onerror = (err) => { console.error(err), this.emit('error', new Error('连接错误')); }
        socket.onmessage = (e) => this._receiveData(e.data);

        super(socket, 'browser', cf);
    }

    send(messageName: string, data?: any[], needACK: boolean = true): Promise<number> {
        // 检查将要序列化的元素中是否包含ArrayBuffer或Blob
        data = data ? data.map(item => {
            if (item instanceof Blob) {
                return blobToBuffer(item);
            }else if (item instanceof ArrayBuffer || item instanceof Uint8Array){
                return typedToBuffer(item)
            }
            return item;
        }) : undefined;
        return super.send(messageName, data, needACK);
    }

    protected _sendData(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(toArrayBuffer(data));

            const check = (interval: number) => {
                setTimeout(() => {
                    if (this.socket.bufferedAmount === 0) {
                        resolve();
                    } else {
                        check(interval >= 2000 ? 2000 : interval * 2); //最慢2秒检查一次
                    }
                }, interval);
            }

            check(10);
        });
    }

    close() {
        this.socket.close();
    }
}