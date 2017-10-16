import * as Emitter from 'component-emitter';
import * as WS from 'ws';
import { serialize, deserialize, NodeBuffer } from 'object2buffer';
import { dataType } from 'object2buffer/src/DataType';

import { ReadyState } from "./ReadyState";
import { BaseSocketConfig } from './BaseSocketConfig';
import { QueueData } from './QueueData';

/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
export abstract class BaseSocket extends Emitter {
    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1
     */
    private _messageID = 0;

    private readonly _needDeserialize: boolean;

    private readonly _maxPayload: number;

    /**
     * 等待发送消息的队列。key：messageID。
     */
    private readonly _queue: Map<number, QueueData> = new Map();

    /**
     * 保存被包装的socket对象
     */
    readonly _socket: WebSocket | WS;

    /**
     * WebSocket server 的URL地址   
     * 注意：如果是Server生成的Socket，则url为空字符串
     */
    readonly url: string;

    /**
     * 连接的当前状态
     */
    get readyState(): ReadyState {
        return this._socket.readyState;
    }

    /**
     * 在缓冲队列中等待发送的数据字节数
     */
    get bufferedAmount(): number {
        let size = 0;

        for (let item of this._queue.values()) {
            size += item.data.length;
        }

        return size;
    }

    constructor(configs: BaseSocketConfig) {
        super();

        this.url = configs.url;
        this._needDeserialize = configs.needDeserialize === undefined ? true : configs.needDeserialize;
        this._maxPayload = configs.maxPayload === undefined ? 1024 * 1024 * 100 : configs.maxPayload;

        if (configs.socket === undefined)
            throw new Error('传入BaseSocket的configs.socket不可以为空');
        else
            this._socket = configs.socket;

        this.once('close', () => {    //如果断开，终止所有还未发送的消息
            for (let item of [...this._queue.values()].reverse()) { //从后向前取消
                const result = item.cancel(new Error('连接中断'));
                if (result === false)
                    item.ack(new Error('连接中断'));    //取消正在发送的
            }
        });
    }

    /**
     * 序列化消息头部。    
     * 
     * @private
     * @param {boolean} isInternal 是否是内部消息
     * @param {dataType} messageName 消息的名称
     * @param {boolean} needACK 
     * @param {number} messageID
     * @returns {Buffer} 
     * @memberof BaseSocket
     */
    private _serializeHeader(isInternal: boolean, messageName: dataType, needACK: boolean, messageID: number): Buffer {
        const header = serialize([isInternal, needACK, messageID, messageName]);
        const headerLength = NodeBuffer.alloc(8);
        headerLength.writeDoubleBE(header.length, 0);

        return NodeBuffer.concat([headerLength, header]);
    }

    /**
     * 反序列化头部
     */
    private _deserializeHeader(data: Buffer) {
        const headerLength = data.readDoubleBE(0);
        const header = deserialize(data.slice(8, headerLength + 8));

        return {
            isInternal: header[0] as boolean,
            needACK: header[1] as boolean,
            messageID: header[2] as number,
            messageName: header[3],
            headerLength: 8 + headerLength
        };
    }

    /**
     * 发送数据。发送失败直接抛出异常
     * 
     * @param {dataType} messageName 消息的名称(标题)
     * @param {dataType[]} [data=[]] 要发送的数据。如果是传入的是数组，则数据将使用object2buffer进行序列化。如果传入的是Buffer，则将直接被发送。(注意：传入的Buffer如果不是object2buffer序列化产生的，则需要接收方设置needDeserialize = false)
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @param {boolean} [prior=false] 是否直接发送（在缓冲队列中排队。默认false）
     * @returns {(Promise<void> & { messageID: number })} messageID
     */
    send(messageName: dataType, data: dataType[] | Buffer = [], needACK: boolean = true, prior: boolean = false) {
        return this._send(false, prior, messageName, needACK, data);
    }

    /**
      * 发送内部数据。发送失败直接抛出异常。内部数据默认不需要接收端确认 ，并且默认优先发送     
      * 注意：要在每一个调用的地方做好异常处理
      */
    protected _sendInternal(messageName: dataType, data: dataType[] | Buffer = [], needACK: boolean = false, prior: boolean = true) {
        return this._send(true, prior, messageName, needACK, data);
    }

    private _send(isInternal: boolean, prior: boolean, messageName: dataType, needACK: boolean, data: dataType[] | Buffer): Promise<void> & { messageID: number } {
        const msgID = this._messageID++;

        const prom: any = new Promise((resolve, reject) => {
            const header = this._serializeHeader(isInternal, messageName, needACK, msgID);

            let sendingData: Buffer;    //要发送的数据
            if (Array.isArray(data))
                sendingData = NodeBuffer.concat([header, serialize(data)]);
            else
                sendingData = NodeBuffer.concat([header, data]);

            if (sendingData.length >= this._maxPayload)
                throw new Error('发送的数据大小超过了限制');

            const control: QueueData = {
                data: sendingData,
                messageID: msgID,
                sent: false,
                cancel: (err) => {  //还未发送之前才可以取消
                    if (control.sent)
                        return false;
                    else {
                        this._queue.delete(msgID);
                        err ? reject(err) : resolve();
                        return true;
                    }
                },
                send: () => {
                    if (control.sent) return;   //避免重复发送
                    control.sent = true;

                    if (needACK) {
                        this._sendData(sendingData).catch(control.ack);
                    } else {
                        this._sendData(sendingData).then(<any>control.ack).catch(control.ack);
                    }
                },
                ack: (err) => {
                    const isFirst = this._queue.values().next().value === control;
                    this._queue.delete(msgID);
                    err ? reject(err) : resolve();

                    if (isFirst && this._queue.size > 0)   //如果队列中还有，并且自己位于队列头部（主要针对prior的情况），则发送下一条
                        this._queue.values().next().value.send();
                }
            };

            this._queue.set(msgID, control);    //添加到队列中

            if (prior || this._queue.size === 1) {   //如果只有刚刚设置的这一条
                control.send();
            }
        });

        prom.messageID = msgID;
        return prom;
    }

    /**
     * 需要子类覆写。用于发送数据
     * 
     * @protected
     * @abstract
     * @param {Buffer} data 要发送的数据
     * @returns {Promise<void>} 
     * @memberof BaseSocket
     */
    protected abstract _sendData(data: Buffer): Promise<void>;

    /**
     * 解析接收到数据。子类接收到消息后需要触发这个方法
     * 
     * @protected
     * @param {Buffer} data 接收到数据
     * @memberof BaseSocket
     */
    protected _receiveData(data: Buffer) {
        try {
            const header = this._deserializeHeader(data);

            if (header.needACK)
                this._sendInternal('ack', [header.messageID]).catch(err => this.emit('error', err));

            if (header.isInternal) {    //如果接收到的是内部发来的消息
                const body = deserialize(data.slice(header.headerLength));

                switch (header.messageName) {
                    case 'ack':
                        const callback = this._queue.get(body[0] as number);
                        callback && callback.ack();
                        break;
                }
            } else {
                const body = this._needDeserialize ? deserialize(data.slice(header.headerLength)) : data.slice(header.headerLength);
                setTimeout(() => {  //避免被外层的try catch捕捉到
                    this.emit('message', header.messageName, body);
                }, 0);
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * 取消发送。如果某条消息还没有被发送则可以被取消。取消成功返回true，失败false
     * 
     * @param {number} messageID 要取消发送消息的messageID
     * @param {Error} [err] 传递一个error，指示本次发送失败的原因
     * @returns {boolean} 取消成功返回true，失败false
     * @memberof BaseSocket
     */
    cancel(messageID: number, err?: Error): boolean {
        const control = this._queue.get(messageID);

        if (control) {
            return control.cancel(err);
        }

        return false;
    }

    /**
     * 关闭接口。关闭之后会触发close事件
     * 
     * @abstract
     * @returns {void} 
     * @memberof BaseSocket
     */
    abstract close(): void;

    on(event: 'error', listener: (err: Error) => void): this
    /**
     * 当收到消息
     */
    on(event: 'message', listener: (messageName: string, data: any[] | Buffer) => void): this
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
    once(event: 'message', listener: (messageName: string, data: any[] | Buffer) => void): this
    once(event: 'open', listener: () => void): this
    once(event: 'close', listener: (code: number, reason: string) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}