import * as Emitter from 'component-emitter';
import { ReadyState } from "./ReadyState";
import { ClientConfig } from './ClientConfig';
import { DataType } from '../common/DataType';
const isBuffer = require('is-buffer');
const _Buffer: typeof Buffer = Buffer ? Buffer : require('buffer');  // 确保浏览器下也能使用Buffer

/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
export default abstract class BaseSocket extends Emitter {

    /**
     * _messageID 的ID号，id从0开始。每发一条needACK的消息，该id加1
     * 
     * @private
     * @memberof BaseSocket
     */
    private _messageID = 0;

    /**
     * 接收到的messageID编号
     * 
     * @private
     * @memberof BaseSocket
     */
    private _receivedMessageID = -1;

    /**
     * 保存接收接收端发回的确认消息的回调函数
     * key:_messageID
     * 
     * @private
     * @memberof BaseSocket
     */
    private readonly _message: Map<number, Function> = new Map();

    private readonly _sendingTimeout: number;

    private readonly _sendingRetry: number;

    private readonly _needDeserialize: boolean;

    /**
     * 保存被包装的socket对象
     * 
     * @type {*}
     * @memberof BaseSocket
     */
    readonly socket: any;

    /**
     * WebSocket server 的URL地址
     * 
     * @type {string}
     * @memberof BaseSocket
     */
    readonly url: string;

    readonly platform: "browser" | "node";

    /**
     * 连接的当前状态
     * 
     * @readonly
     * @abstract
     * @type {ReadyState}
     * @memberof BaseSocket
     */
    abstract get readyState(): ReadyState;

    /**
     * 调用 send() 方法将多字节数据加入到队列中等待传输，但是还未发出。该值会在所有队列数据被发送后重置为 0。而当连接关闭时不会设为0。如果持续调用send()，这个值会持续增长。
     * 
     * @readonly
     * @abstract
     * @type {number}
     * @memberof BaseSocket
     */
    abstract get bufferedAmount(): number;

    /**
     * @param {*} socket 子类实例化的socket对象
     * @param {("browser" | "node")} platform 指示该接口所处的平台
     * @param {ClientConfig} configs 配置
     * @memberof BaseSocket
     */
    constructor(socket: any, platform: "browser" | "node", configs: ClientConfig) {
        super();

        const {
            url,
            sendingRetry = 3,
            sendingTimeout = 1000 * 60,
            needDeserialize = true
        } = configs;

        this.url = url;
        this._sendingRetry = sendingRetry;
        this._sendingTimeout = sendingTimeout;
        this._needDeserialize = needDeserialize;
        this.socket = socket;
        this.platform = platform;
    }

    /**
     * 对要发送的数据进行序列化。注意只有位于数组根下的boolean、string、number、void、Buffer才会进行二进制序列化，对象会被JSON.stringify    
     * 数据格式： 元素类型 -> [元素长度] -> 元素内容
     * 
     * @static
     * @memberof BaseSocket
     */
    static serialize(data: any[]): Buffer {
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

        return _Buffer.concat(bufferItems);
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

                    const content = data.slice(previous, length);
                    result.push(content.toString());
                    previous += length;
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

                    result.push(data.slice(previous, length));
                    previous += length;
                    break;
                }
                case DataType.Object: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;

                    const content = data.slice(previous, length);
                    result.push(JSON.parse(content.toString()));
                    previous += length;
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
     * 数据格式：头部长度 -> 消息名称长度 -> 消息名称 -> 该消息是否需要确认收到 -> [消息id]
     * 
     * @private
     * @param {string} messageName 消息的名称
     * @param {boolean} needACK 
     * @param {number} [messageID]
     * @returns {Buffer} 
     * @memberof BaseSocket
     */
    private serializeHeader(messageName: string, needACK: boolean, messageID?: number): Buffer {
        let _headerLength = _Buffer.alloc(8);
        let _messageNameLength = _Buffer.alloc(8);
        let _messageName = _Buffer.from(messageName);
        let _needACK = _Buffer.alloc(1);
        let _messageID = needACK ? _Buffer.alloc(8) : _Buffer.alloc(0);

        _messageNameLength.writeDoubleBE(_messageName.length, 0);
        _needACK.writeUInt8(needACK ? 1 : 0, 0);
        needACK && _messageID.writeDoubleBE(<any>messageID, 0);

        let length = _headerLength.length + _messageName.length + _messageNameLength.length + _needACK.length + _messageID.length;
        _headerLength.writeDoubleBE(length, 0);

        return Buffer.concat([_headerLength, _messageNameLength, _messageName, _needACK, _messageID], length);
    }

    /**
     * 反序列化头部
     * @param data 头部二进制数据
     */
    private deserializeHeader(data: Buffer) {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');

        const header = {
            messageName: '',
            needACK: false,
            messageID: -1,
            headerLength: 0
        };

        header.headerLength = data.readDoubleBE(0);
        let index = 8;

        const messageNameLength = data.readDoubleBE(index);
        index += 8;

        header.messageName = data.slice(index, index + messageNameLength).toString();
        index += messageNameLength;

        header.needACK = data.readUInt8(index++) === 1;
        header.messageID = data.readDoubleBE(index);

        return header;
    }

    /**
     * 发送数据。发送失败直接抛出异常
     * 
     * @param {string} messageName 消息的名称(标题)
     * @param {any[]} [data] 要发送的数据。如果只发送messageName，数据可以留空
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @returns {Promise<void>} 
     * @memberof BaseSocket
     */
    send(messageName: string, data?: any[], needACK: boolean = true): Promise<void> {
        return new Promise((resolve, reject) => {
            const body = data ? BaseSocket.serialize(data) : _Buffer.alloc(0);
            if (needACK) {
                const messageID = this._messageID++;
                const header = this.serializeHeader(messageName, needACK, messageID);
                const data = _Buffer.concat([header, body]);

                this._message.set(messageID, () => {
                    this._message.delete(messageID);
                    resolve();
                });

                (async () => {
                    try {
                        for (var index = 0; index < this._sendingRetry; index++) {
                            if (!this._message.has(messageID)) return;   //判断对方是否已经收到了

                            await this._sendData(data);
                            await new Promise(res => setTimeout(res, this._sendingTimeout));
                        }
                        throw new Error(`发送数据失败。在尝试${this._sendingRetry}次重发之后，接收端依然没有回应收到。`);
                    } finally {
                        this._message.delete(messageID);
                    }
                })().then(resolve).catch(reject);
            } else {
                const header = this.serializeHeader(messageName, needACK);
                this._sendData(_Buffer.concat([header, body])).then(resolve).catch(reject);
            }
        });
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
     * @private
     * @param {*} data 接收到数据
     * @memberof BaseSocket
     */
    protected _receiveData(data: Buffer) {
        const header = this.deserializeHeader(data);
        if (header.messageName === '__bws_internal__') {    //如果接收到的是内部发来的消息
            const body = BaseSocket.deserialize(data.slice(header.headerLength));

            switch (body[0]) {
                case 'ack':
                    const callback = this._message.get(body[1]);
                    callback && callback();
                    break;
            }
        } else {
            const body = this._needDeserialize ? BaseSocket.deserialize(data.slice(header.headerLength)) : data.slice(header.headerLength);

            if (header.needACK) {
                if (this._receivedMessageID < header.messageID) {   //确保不会重复触发
                    this._receivedMessageID = header.messageID;
                    this.emit('message', header.messageName, body);
                }

                this.send('__bws_internal__', ['ack', header.messageID], false);
            } else {
                this.emit('message', header.messageName, body);
            }
        }
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
     * 当服务器开始监听
     */
    on(event: 'message', cb: (messageName: string, data: any[]) => void): this
    /**
     * 当服务器开始监听
     */
    on(event: 'open', cb: () => void): this
    on(event: 'close', cb: (err: Error) => void): this
    on(event: string, listener: Function): this {
        super.on(event, listener);
        return this;
    }

    once(event: 'error', cb: (err: Error) => void): this
    /**
     * 当服务器开始监听
     */
    once(event: 'message', cb: (messageName: string, data: any[]) => void): this
    /**
     * 当服务器开始监听
     */
    once(event: 'open', cb: () => void): this
    once(event: 'close', cb: (err: Error) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}