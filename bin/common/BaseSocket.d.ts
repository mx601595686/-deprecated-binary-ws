/// <reference types="ws" />
/// <reference types="node" />
import * as Emitter from 'component-emitter';
import * as WS from 'ws';
import { dataType } from 'object2buffer/src/DataType';
import { ReadyState } from "./ReadyState";
import { BaseSocketConfig } from './BaseSocketConfig';
/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
export declare abstract class BaseSocket extends Emitter {
    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1
     */
    private _messageID;
    private readonly _needDeserialize;
    private readonly _maxPayload;
    /**
     * 等待发送消息的队列。key：messageID。
     */
    private readonly _queue;
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
    readonly readyState: ReadyState;
    /**
     * 在缓冲队列中等待发送的数据字节数
     */
    readonly bufferedAmount: number;
    constructor(configs: BaseSocketConfig);
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
    private _serializeHeader(isInternal, messageName, needACK, messageID);
    /**
     * 反序列化头部
     */
    private _deserializeHeader(data);
    /**
     * 发送数据。发送失败直接抛出异常
     *
     * @param {dataType} messageName 消息的名称(标题)
     * @param {dataType[] | Buffer} [data=[]] 要发送的数据。如果是传入的是数组，则数据将使用object2buffer进行序列化。如果传入的是Buffer，则将直接被发送。(注意：传入的Buffer如果不是object2buffer序列化产生的，则需要接收方设置needDeserialize = false)
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @param {boolean} [prior=false] 是否直接发送（在缓冲队列中排队。默认false）
     * @returns {(Promise<void> & { messageID: number })} messageID
     */
    send(messageName: dataType, data?: dataType[] | Buffer, needACK?: boolean, prior?: boolean): Promise<void> & {
        messageID: number;
    };
    /**
      * 发送内部数据。发送失败直接抛出异常。内部数据默认不需要接收端确认 ，并且默认优先发送
      * 注意：要在每一个调用的地方做好异常处理
      */
    protected _sendInternal(messageName: dataType, data?: dataType[] | Buffer, needACK?: boolean, prior?: boolean): Promise<void> & {
        messageID: number;
    };
    private _send(isInternal, prior, messageName, needACK, data);
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
    protected _receiveData(data: Buffer): void;
    /**
     * 取消发送。如果某条消息还没有被发送则可以被取消。取消成功返回true，失败false
     *
     * @param {number} messageID 要取消发送消息的messageID
     * @param {Error} [err] 传递一个error，指示本次发送失败的原因
     * @returns {boolean} 取消成功返回true，失败false
     * @memberof BaseSocket
     */
    cancel(messageID: number, err?: Error): boolean;
    /**
     * 关闭接口。关闭之后会触发close事件
     *
     * @abstract
     * @returns {void}
     * @memberof BaseSocket
     */
    abstract close(): void;
    on(event: 'error', listener: (err: Error) => void): this;
    /**
     * 当收到消息
     */
    on(event: 'message', listener: (messageName: string, data: any[] | Buffer) => void): this;
    /**
     * 当连接建立
     */
    on(event: 'open', listener: () => void): this;
    /**
     * 断开连接
     */
    on(event: 'close', listener: (code: number, reason: string) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'message', listener: (messageName: string, data: any[] | Buffer) => void): this;
    once(event: 'open', listener: () => void): this;
    once(event: 'close', listener: (code: number, reason: string) => void): this;
}
