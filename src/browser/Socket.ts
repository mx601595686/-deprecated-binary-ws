const _Buffer: typeof Buffer = require('buffer/').Buffer;
const toArraybuffer = require('to-arraybuffer');
const blobToBuffer = require('blob-to-buffer');

const isTypedBuffer = require('is-typedarray');
const isBlob = (x: any) => {
    return x instanceof Blob || Object.prototype.toString.call(x) === '[object Blob]';
}
const isArrayBuffer = (x: any) => {
    return x instanceof ArrayBuffer || Object.prototype.toString.call(x) === '[object ArrayBuffer]';
}
const isDataView = (x: any) => {
    return x instanceof DataView || Object.prototype.toString.call(x) === '[object DataView]';
}

import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
import { ReadyState } from "../common/ReadyState";

export class Socket extends BaseSocket {

    readonly socket: WebSocket;

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
        (<WebSocket>(cf.socket)).onmessage = (e) => this._receiveData(_Buffer.from(e.data));

        super('browser', cf);
    }

    /**
     * 浏览器版除了可以直接发送Buffer之外还可以直接发送ArrayBuffer、TypedBuffer、DataView、Blob
     */
    send(messageName: string, data?: any[] | any, needACK: boolean = true) {
        if (Array.isArray(data)) {
            data = data.map(item => this._transformType(item));
        } else {
            data = this._transformType(data);
        }

        return super.send(messageName, data, needACK);
    }

    // 转换成满足发送要求的类型
    private _transformType(data: any): Buffer {
        if (isBlob(data)) {
            return blobToBuffer(data);
        } else if (isArrayBuffer(data) || isTypedBuffer(data)) {
            return _Buffer.from(data);
        } else if (isDataView(data)) {
            return _Buffer.from((<DataView>data).buffer);
        } else {
            return data;
        }
    }

    protected _sendData(data: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(toArraybuffer(data));  //不可以直接发送buffer

            const check = (interval: number) => {
                setTimeout(() => {
                    if (this.socket.bufferedAmount === 0) {
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
        this.socket.close();
    }
}
