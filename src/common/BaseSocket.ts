import * as Emitter from 'component-emitter';
import * as WS from 'ws';
const _Buffer: typeof Buffer = Buffer ? Buffer : require('buffer/').Buffer;  // 确保浏览器下也能使用Buffer
const isBuffer = require('is-buffer');

import { ReadyState } from "./ReadyState";
import { BaseSocketConfig } from './BaseSocketConfig';
import { DataType } from '../common/DataType';
import { QueueData } from './QueueData';

/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
export abstract class BaseSocket extends Emitter {

    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1
     * 
     * @private
     * @memberof BaseSocket
     */
    private _messageID = 0;

    private readonly _needDeserialize: boolean;

    private readonly _maxPayload: number | undefined;

    /**
     * 等待发送消息的队列。key：messageID。
     */
    private readonly _queue: Map<number, QueueData> = new Map();

    /**
     * 保存被包装的socket对象
     * 
     * @type {(WebSocket|WS)}
     * @memberof BaseSocket
     */
    readonly socket: WebSocket | WS;

    /**
     * WebSocket server 的URL地址   
     * 注意：如果是Server生成的Socket，则url为空字符串
     * 
     * @type {string}
     * @memberof BaseSocket
     */
    readonly url: string;

    /**
     * 当前接口运行所处的平台
     * 
     * @type {("browser" | "node")}
     * @memberof BaseSocket
     */
    readonly platform: "browser" | "node";

    /**
     * 连接的当前状态
     * 
     * @readonly
     * @abstract
     * @type {ReadyState}
     * @memberof BaseSocket
     */
    get readyState(): ReadyState {
        return this.socket.readyState;
    }

    /**
     * 在缓冲队列中等待发送的数据字节数
     * 
     * @readonly
     * @abstract
     * @type {number}
     * @memberof BaseSocket
     */
    get bufferedAmount(): number {
        let size = 0;

        for (let item of this._queue.values()) {
            size += item.data.length;
        }

        return size;
    }

    /**
     * @param {("browser" | "node")} platform 指示该接口所处的平台
     * @param {BaseSocketConfig} configs 配置
     * @memberof BaseSocket
     */
    constructor(platform: "browser" | "node", configs: BaseSocketConfig) {
        super();

        this.url = configs.url;
        this._needDeserialize = configs.needDeserialize === undefined ? true : configs.needDeserialize;
        this._maxPayload = configs.maxPayload;
        this.platform = platform;

        if (configs.socket === undefined) {
            throw new Error('传入的socket不可以为空');
        } else {
            this.socket = configs.socket;
        }

        this.on('close', () => {    //如果断开，终止所有还未发送的消息
            for (let item of [...this._queue.values()].reverse()) { //从后向前取消
                const result = item.cancel(new Error('连接中断'));
                if (result === false)
                    item.ack(new Error('连接中断'));    //取消正在发送的
            }
        });
    }

    /**
     * 对要发送的数据进行序列化。注意只有位于数组根下的boolean、string、number、void、Buffer才会进行二进制序列化，对象会被JSON.stringify    
     * 数据格式： 元素类型 -> [元素长度] -> 元素内容
     * 
     * @static
     * @memberof BaseSocket
     */
    static serialize(data: any[]): Buffer & { _serialized: boolean } {
        const bufferItems: Buffer[] = [];

        for (let item of data) {
            switch (typeof item) {
                case 'number': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.alloc(8);

                    type.writeUInt8(DataType.number, 0);
                    content.writeDoubleBE(item, 0);

                    bufferItems.push(type, content);
                    break;
                }
                case 'string': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.from(item);
                    const contentLength = _Buffer.alloc(8);

                    type.writeUInt8(DataType.string, 0);
                    contentLength.writeDoubleBE(content.length, 0);

                    bufferItems.push(type, contentLength, content);
                    break;
                }
                case 'boolean': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.alloc(1);

                    type.writeUInt8(DataType.boolean, 0);
                    content.writeUInt8(item ? 1 : 0, 0);

                    bufferItems.push(type, content);
                    break;
                }
                case 'undefined': {
                    const type = _Buffer.alloc(1);
                    type.writeUInt8(DataType.undefined, 0);

                    bufferItems.push(type);
                    break;
                }
                case 'object': {
                    if (item === null) {
                        const type = _Buffer.alloc(1);
                        type.writeUInt8(DataType.null, 0);

                        bufferItems.push(type);
                    } else if (isBuffer(item)) {
                        const type = _Buffer.alloc(1);
                        const content = item;
                        const contentLength = _Buffer.alloc(8);

                        type.writeUInt8(DataType.Buffer, 0);
                        contentLength.writeDoubleBE(content.length, 0);

                        bufferItems.push(type, contentLength, content);
                    } else {
                        const type = _Buffer.alloc(1);
                        const content = _Buffer.from(JSON.stringify(item));
                        const contentLength = _Buffer.alloc(8);

                        type.writeUInt8(DataType.Object, 0);
                        contentLength.writeDoubleBE(content.length, 0);

                        bufferItems.push(type, contentLength, content);
                    }
                }
            }
        }

        const result: any = _Buffer.concat(bufferItems);
        result._serialized = true;  //标记这份数据是被序列化过了的
        return result;
    }

    /**
     * 对接收到的消息进行反序列化
     * 
     * @static
     * @param {Buffer} data 
     * @memberof BaseSocket
     */
    static deserialize(data: Buffer): any[] {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');

        let previous = 0;
        const result = [];

        while (previous < data.length) {
            const type = data.readUInt8(previous++);

            switch (type) {
                case DataType.number: {
                    result.push(data.readDoubleBE(previous));
                    previous += 8;
                    break;
                }
                case DataType.string: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;

                    const content = data.slice(previous, previous += length);
                    result.push(content.toString());
                    break;
                }
                case DataType.boolean: {
                    const content = data.readUInt8(previous++);
                    result.push(content === 1);
                    break;
                }
                case DataType.undefined: {
                    result.push(undefined);
                    break;
                }
                case DataType.null: {
                    result.push(null);
                    break;
                }
                case DataType.Buffer: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;

                    result.push(data.slice(previous, previous += length));
                    break;
                }
                case DataType.Object: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;

                    const content = data.slice(previous, previous += length);
                    result.push(JSON.parse(content.toString()));
                    break;
                }
                default: {
                    throw new Error('data type don`t exist. type: ' + type);
                }
            }
        }

        return result;
    }

    /**
     * 序列化消息头部。    
     * 数据格式：头部长度 -> 是否是内部消息 -> 消息名称长度 -> 消息名称 -> 该消息是否需要确认收到 -> 消息id
     * 
     * @private
     * @param {boolean} isInternal 是否是内部消息
     * @param {string} messageName 消息的名称
     * @param {boolean} needACK 
     * @param {number} messageID
     * @returns {Buffer} 
     * @memberof BaseSocket
     */
    private _serializeHeader(isInternal: boolean, messageName: string, needACK: boolean, messageID: number): Buffer {
        let _headerLength = _Buffer.alloc(8);
        let _isInternal = _Buffer.alloc(1);
        let _messageNameLength = _Buffer.alloc(8);
        let _messageName = _Buffer.from(messageName);
        let _needACK = _Buffer.alloc(1);
        let _messageID = _Buffer.alloc(8);

        _isInternal.writeUInt8(isInternal ? 1 : 0, 0);
        _messageNameLength.writeDoubleBE(_messageName.length, 0);
        _needACK.writeUInt8(needACK ? 1 : 0, 0);
        _messageID.writeDoubleBE(messageID, 0);

        let length = _headerLength.length + _isInternal.length + _messageName.length + _messageNameLength.length + _needACK.length + _messageID.length;
        _headerLength.writeDoubleBE(length, 0);

        return Buffer.concat([_headerLength, _isInternal, _messageNameLength, _messageName, _needACK, _messageID], length);
    }

    /**
     * 反序列化头部
     * @param data 头部二进制数据
     */
    private _deserializeHeader(data: Buffer) {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');

        const header = {
            isInternal: true,
            messageName: '',
            needACK: false,
            messageID: -1,
            headerLength: 0
        };

        header.headerLength = data.readDoubleBE(0);
        let index = 8;

        header.isInternal = data.readUInt8(index++) === 1;

        const messageNameLength = data.readDoubleBE(index);
        index += 8;

        header.messageName = data.slice(index, index += messageNameLength).toString();

        header.needACK = data.readUInt8(index++) === 1;

        header.messageID = data.readDoubleBE(index);

        return header;
    }

    /**
     * 发送数据。发送失败直接抛出异常
     * 
     * @param {string} messageName 消息的名称(标题)
     * @param {(any[] | Buffer)} [data=[]] 要发送的数据。如果是传入的是数组，则数据将使用BaseSocket.serialize() 进行序列化。如果传入的是Buffer，则将直接被发送。(注意：传入的Buffer必须是BaseSocket.serialize()产生的)
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @param {boolean} [prior=false] 是否直接发送（不在缓冲队列中排队。默认false）
     * @returns {(Promise<void> & { messageID: number })} messageID
     * @memberof BaseSocket
     */
    send(messageName: string, data: any[] | Buffer = [], needACK: boolean = true, prior: boolean = false) {
        return this._send(false, prior, messageName, needACK, data);
    }

    /**
      * 发送内部数据。发送失败直接抛出异常。内部数据默认不需要接收端确认 ，并且默认优先发送     
      * 注意：要在每一个调用的地方做好异常处理
      */
    protected _sendInternal(messageName: string, data: any[] | Buffer = [], needACK: boolean = false, prior: boolean = true) {
        return this._send(true, prior, messageName, needACK, data);
    }

    private _send(isInternal: boolean, prior: boolean, messageName: string, needACK: boolean, data: any[] | Buffer): Promise<void> & { messageID: number } {
        const msgID = this._messageID++;
        const prom: any = new Promise((resolve, reject) => {
            const header = this._serializeHeader(isInternal, messageName, needACK, msgID);

            let sendingData: Buffer;    //要发送的数据
            if (Array.isArray(data)) {
                sendingData = _Buffer.concat([header, BaseSocket.serialize(data)]);
            } else if (isBuffer(data)) {
                if ((<any>data)._serialized)
                    sendingData = _Buffer.concat([header, data]);
                else
                    throw new Error('要被发送的Buffer并不是BaseSocket.serialize()序列化产生的');
            } else {
                throw new Error(`传入的数据类型存在问题，必须是数组或Buffer，而实际类型是：${Object.prototype.toString.call(data)}`);
            }

            if (this._maxPayload !== undefined && sendingData.length > this._maxPayload) {
                throw new Error('发送的数据大小超过了限制');
            }

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
     * 需要子类覆写。调用_socket发送数据
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
            //console.log(header)
            if (header.needACK)
                this._sendInternal('ack', [header.messageID]).catch(err => this.emit('error', err));

            if (header.isInternal) {    //如果接收到的是内部发来的消息
                const body = BaseSocket.deserialize(data.slice(header.headerLength));

                switch (header.messageName) {
                    case 'ack':
                        const callback = this._queue.get(body[0]);
                        callback && callback.ack();
                        break;
                }
            } else {
                const body = this._needDeserialize ? BaseSocket.deserialize(data.slice(header.headerLength)) : data.slice(header.headerLength);
                setTimeout(() => {  //避免被外层的try catch捕捉到
                    this.emit('message', header.messageName, body);
                }, 0);
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * 取消发送。如果某条消息还没有被取消则可以被取消。取消成功返回true，失败false
     * 
     * @param {number} messageID 要取消发送消息的messageID
     * @param {Error} [err] 传递一个error，指示本次发送属于失败
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

    on(event: 'error', cb: (err: Error) => void): this
    /**
     * 当收到消息
     */
    on(event: 'message', cb: (messageName: string, data: any[] | Buffer) => void): this
    /**
     * 当连接建立
     */
    on(event: 'open', cb: () => void): this
    /**
     * 断开连接
     */
    on(event: 'close', cb: (code: number, reason: string) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    once(event: 'error', cb: (err: Error) => void): this
    /**
     * 当收到消息
     */
    once(event: 'message', cb: (messageName: string, data: any[] | Buffer) => void): this
    /**
     * 当连接建立
     */
    once(event: 'open', cb: () => void): this
    once(event: 'close', cb: (code: number, reason: string) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}