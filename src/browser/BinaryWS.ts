import { ClientConfig } from './../common/ClientConfig';
import BaseSocket from "../common/BaseSocket";
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
     * @memberof BinaryWS
     */
    constructor(url: string)
    constructor(configs: ClientConfig)
    constructor(args?: any) {
        const cf: ClientConfig = {
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
        socket.onerror = (err) => this.emit('error', new Error(err.toString()));
        socket.onmessage = (e) => this.onMessage(e.data);
        
        super(socket, 'browser', cf);
    }

    protected _sendData(data: ArrayBuffer): Promise<void> {
        throw new Error("Method not implemented.");
    }

    close() {
        this.socket.close();
    }
}