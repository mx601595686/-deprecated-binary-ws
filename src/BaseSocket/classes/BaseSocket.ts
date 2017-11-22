import * as Emitter from 'component-emitter';
import * as WS from 'ws';

import { ReadyState } from "../interfaces/ReadyState";
import { BaseSocketConfig } from '../interfaces/BaseSocketConfig';

/**
 * websocket 接口的抽象类，定义了需要实现的基础功能
 */
export abstract class BaseSocket extends Emitter {

    /**
     * 每新建一个接口+1
     */
    private static _id_Number = 0;

    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1。
     */
    private _messageID = 0;

    /**
     * 消息的发送队列。如果要取消发送，可以向send中传递以error
     */
    private readonly _sendingQueue: Map<number, { size: number, send: (err?: Error) => void }> = new Map();

    /**
     * 保存被包装的socket对象
     */
    protected readonly _socket: WebSocket | WS;

    /**
     * 当前接口的id
     */
    readonly id: number;

    readonly url: string;

    readonly maxPayload: number;

    /**
     * 连接的当前状态
     */
    get readyState(): ReadyState {
        return this._socket.readyState;
    }

    /**
     * 在缓冲队列中等待发送的数据大小
     */
    get bufferedAmount(): number {
        let size = 0;

        for (let item of this._sendingQueue.values()) {
            size += item.size;
        }

        return size;
    }

    constructor(socket: WebSocket | WS, configs: BaseSocketConfig) {
        super();

        this.id = BaseSocket._id_Number++;
        this._socket = socket;
        this.url = configs.url;
        this.maxPayload = configs.maxPayload == null || configs.maxPayload <= 0 ? 0 : configs.maxPayload + 1024;

        this.once('close', () => {    //如果断开，终止所有还未发送的消息。从后向前取消
            for (let item of [...this._sendingQueue.keys()].reverse())
                this.cancel(item, new Error('连接中断'));
        });
    }

    /**
     * 需要子类覆写。用于发送数据
     */
    protected abstract async _sendData(data: Buffer): Promise<void>;

    /**
     * 关闭接口。关闭之后会触发close事件
     */
    abstract close(): void;

    /**
     * 发送消息。(返回的promise中包含该条消息的messageID)
     * @param title 消息的标题
     * @param data 携带的数据
     */
    send(title: string, data: Buffer): Promise<void> & { messageID: number } {
        const messageID = this._messageID++;

        const result: any = new Promise((resolve, reject) => {
            const b_title = Buffer.from(title);
            const b_title_length = Buffer.alloc(4);
            b_title_length.writeUInt32BE(b_title.length, 0);

            const r_data = Buffer.concat([b_title_length, b_title, data]);

            if (r_data.length > this.maxPayload)
                throw new Error('发送的消息大小超出了限制');

            const send = (err?: Error) => {
                if (err != null) {
                    reject(err);
                    this._sendingQueue.delete(messageID);
                } else {
                    this._sendData(r_data).then(resolve as any).catch(reject).then(() => {
                        this._sendingQueue.delete(messageID);
                        if (this._sendingQueue.size > 0)
                            this._sendingQueue.values().next().value.send();
                    });
                }
            }

            this._sendingQueue.set(messageID, { size: r_data.length, send });
            if (this._sendingQueue.size === 1) send();  //如果没有消息排队就直接发送
        });

        result.messageID = messageID;
        return result;
    }

    /**
     * 取消发送
     * @param messageID 要取消发送消息的messageID
     * @param err 传递一个error，指示取消的原因
     */
    cancel(messageID: number, err: Error = new Error('发送取消')) {
        const item = this._sendingQueue.get(messageID);
        if (item != null) item.send(err);
    }

    /**
     * 解析接收到数据。子类接收到消息后需要触发这个方法
     * 
     * @param data 接收到数据
     */
    protected _receiveData(data: Buffer) {
        try {
            let offset = 0;
            const title_length = data.readUInt32BE(0); offset += 4;
            const title = data.slice(offset, offset += title_length).toString();
            const r_data = data.slice(offset);

            this.emit('message', title, r_data);
        } catch (error) {
            this.emit('error', error);
        }
    }

    on(event: 'error', listener: (err: Error) => void): this
    /**
     * 当收到消息
     */
    on(event: 'message', listener: (title: string, data: Buffer) => void): this
    /**
     * 当连接建立
     */
    on(event: 'open', listener: () => void): this
    /**
     * 断开连接
     */
    on(event: 'close', listener: (code: number, reason: string) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    once(event: 'error', listener: (err: Error) => void): this
    once(event: 'message', listener: (title: string, data: Buffer) => void): this
    once(event: 'open', listener: () => void): this
    once(event: 'close', listener: (code: number, reason: string) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}