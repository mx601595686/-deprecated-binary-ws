const blobToBuffer = require('blob-to-buffer');
const toArrayBuffer = require('to-arraybuffer');

import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { BaseSocket } from "../common/BaseSocket";
import { ReadyState } from "../common/ReadyState";

export default class BinaryWS extends BaseSocket {

    readonly socket: WebSocket;

    get readyState(): ReadyState {
        return this.socket.readyState as any;
    }

    get bufferedAmount(): number {
        return this.socket.bufferedAmount;
    }

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
        socket.onclose = () => this.emit('close');
        socket.onerror = (err) => { console.error(err), this.emit('error', new Error(err.toString())); }
        socket.onmessage = (e) => this._receiveData(e.data);

        super(socket, 'browser', cf);
    }

    send(messageName: string, data?: any[], needACK: boolean = true): Promise<void> {
        // 检查将要序列化的元素中是否包含ArrayBuffer或Blob
        data = data ? data.map(item => {
            if (item instanceof Blob) {
                return blobToBuffer(item);
            }
            return item;
        }) : undefined;
        return super.send(messageName, data, needACK);
    }

    protected async _sendData(data: Buffer): Promise<void> {
        this.socket.send(toArrayBuffer(data));
    }

    close() {
        this.socket.close();
    }
}