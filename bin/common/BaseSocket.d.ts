/// <reference types="node" />
import * as Emitter from 'component-emitter';
import { ReadyState } from "./ReadyState";
import { BaseSocketConfig } from './BaseSocketConfig';
/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
export declare abstract class BaseSocket extends Emitter {
    /**
     * _messageID 的ID号，id从0开始。每发一条needACK的消息，该id加1
     *
     * @private
     * @memberof BaseSocket
     */
    private _messageID;
    /**
     * 接收到的messageID编号
     *
     * @private
     * @memberof BaseSocket
     */
    private _receivedMessageID;
    /**
     * 保存接收接收端发回的确认消息的回调函数
     * key:_messageID
     *
     * @private
     * @memberof BaseSocket
     */
    private readonly _message;
    private readonly _sendingTimeout;
    private readonly _sendingRetry;
    private readonly _needDeserialize;
    /**
     * 发送ping来检查连接是否正常的间隔时间。
     * 连续失败3次就会断开连接
     *
     * @private
     * @type {number}
     * @memberof BaseSocket
     */
    private readonly _pingInterval;
    /**
     * 收到客户端发来ping时的时间戳
     */
    private _receivedPing;
    /**
     * 保存被包装的socket对象
     *
     * @type {*}
     * @memberof BaseSocket
     */
    readonly socket: any;
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
    readonly abstract readyState: ReadyState;
    /**
     * 调用 send() 方法将多字节数据加入到队列中等待传输，但是还未发出。该值会在所有队列数据被发送后重置为 0。而当连接关闭时不会设为0。如果持续调用send()，这个值会持续增长。
     *
     * @readonly
     * @abstract
     * @type {number}
     * @memberof BaseSocket
     */
    readonly abstract bufferedAmount: number;
    /**
     * @param {*} socket 子类实例化的socket对象
     * @param {("browser" | "node")} platform 指示该接口所处的平台
     * @param {BaseSocketConfig} configs 配置
     * @memberof BaseSocket
     */
    constructor(socket: any, platform: "browser" | "node", configs: BaseSocketConfig);
    /**
     * 对要发送的数据进行序列化。注意只有位于数组根下的boolean、string、number、void、Buffer才会进行二进制序列化，对象会被JSON.stringify
     * 数据格式： 元素类型 -> [元素长度] -> 元素内容
     *
     * @static
     * @memberof BaseSocket
     */
    static serialize(data: any[]): Buffer;
    /**
     * 对接收到的消息进行反序列化
     *
     * @static
     * @param {Buffer} data
     * @memberof BaseSocket
     */
    static deserialize(data: Buffer): any[];
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
    private serializeHeader(messageName, needACK, messageID?);
    /**
     * 反序列化头部
     * @param data 头部二进制数据
     */
    private deserializeHeader(data);
    /**
     * 启动ping检查连接是否正常
     *
     * @private
     * @memberof BaseSocket
     */
    private monitorPing();
    /**
     * 发送数据。发送失败直接抛出异常
     *
     * @param {string} messageName 消息的名称(标题)
     * @param {any[]} [data] 要发送的数据。如果只发送messageName，数据可以留空
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @returns {Promise<void>}
     * @memberof BaseSocket
     */
    send(messageName: string, data?: any[], needACK?: boolean): Promise<void>;
    /**
     * 发送内部数据。
     * 注意：所有发送的内部消息都是不需要对方验证是否收到的。如果发送时出现错误会自动触发error事件
     *
     * @protected
     * @param {string} messageName 消息名称
     * @param {...any[]} data 其余数据
     * @memberof BaseSocket
     */
    protected _sendInternal(messageName: string, ...data: any[]): Promise<boolean | void>;
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
    protected _receiveData(data: Buffer): void;
    /**
     * 关闭接口。关闭之后会触发close事件
     *
     * @abstract
     * @returns {void}
     * @memberof BaseSocket
     */
    abstract close(): void;
    on(event: 'error', cb: (err: Error) => void): this;
    /**
     * 当收到消息
     */
    on(event: 'message', cb: (messageName: string, data: any[]) => void): this;
    /**
     * 当连接建立
     */
    on(event: 'open', cb: () => void): this;
    on(event: 'close', cb: (err: Error) => void): this;
    once(event: 'error', cb: (err: Error) => void): this;
    /**
     * 当收到消息
     */
    once(event: 'message', cb: (messageName: string, data: any[]) => void): this;
    /**
     * 当连接建立
     */
    once(event: 'open', cb: () => void): this;
    once(event: 'close', cb: (err: Error) => void): this;
}
