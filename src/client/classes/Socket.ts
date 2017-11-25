import { BaseSocket } from "../../BaseSocket/classes/BaseSocket";
import { BaseSocketConfig } from "../../BaseSocket/interfaces/BaseSocketConfig";

if (!require('is-node')) Buffer = require('buffer/').Buffer;
const nodeBufferToArraybuffer = require('to-arraybuffer');

export class Socket extends BaseSocket {

    protected readonly _socket: WebSocket;

    constructor(configs: BaseSocketConfig = { url: `ws${location.protocol === 'https:' ? 's' : ''}://${location.host}` }) {
        super(new WebSocket(configs.url), configs);

        this._socket.binaryType = 'arraybuffer';
        this._socket.onopen = () => this.emit('open');
        this._socket.onclose = (ev) => this.emit('close', ev.code, ev.reason);
        this._socket.onerror = (err) => { console.error(err), this.emit('error', new Error('连接异常')); }
        this._socket.onmessage = (e) => this._receiveData(Buffer.from(e.data));
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