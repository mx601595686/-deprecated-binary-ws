const isBuffer = require('is-buffer');
const isBlob = require('is-blob');
const isArrayBuffer = require('is-array-buffer');
const isTypedBuffer = require('is-typedarray');

const blobToBuffer = require('blob-to-buffer');
const typedToBuffer = require('typedarray-to-buffer');
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

        if (!(cf.socket instanceof WebSocket))
            cf.socket = new WebSocket(cf.url);

        (<WebSocket>(cf.socket)).binaryType = 'arraybuffer';
        (<WebSocket>(cf.socket)).onopen = () => this.emit('open');
        (<WebSocket>(cf.socket)).onclose = (ev) => this.emit('close', ev.code, ev.reason);
        (<WebSocket>(cf.socket)).onerror = (err) => { console.error(err), this.emit('error', new Error('连接错误')); }
        (<WebSocket>(cf.socket)).onmessage = (e) => this._receiveData(e.data);

        super('browser', cf);
    }
    /**
     * 浏览器版除了可以直接发送Buffer之外还可以直接发送ArrayBuffer、TypedBuffer、Blob
     */
    send(messageName: string, data?: any[] | any, needACK: boolean = true) {
        if (Array.isArray(data)) {
            data = data.map(item => {
                if (isBuffer(item)) {
                    return item;
                } else if (isBlob(item)) {
                    return blobToBuffer(item)
                } else if (isArrayBuffer(item) || isTypedBuffer(item)) {
                    return typedToBuffer(item)
                } else {
                    return item;
                }
            });
        } else if (isBuffer(data)) {
            data = data;
        } else if (isBlob(data)) {
            data = blobToBuffer(data)
        } else if (isArrayBuffer(data) || isTypedBuffer(data)) {
            data = typedToBuffer(data)
        }

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