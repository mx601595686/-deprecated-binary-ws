/// <reference types="ws" />
/// <reference types="node" />
import * as Emitter from 'component-emitter';
import * as WS from 'ws';
import { ReadyState } from "../interfaces/ReadyState";
import { BaseSocketConfig } from '../interfaces/BaseSocketConfig';
/**
 * websocket 接口的抽象类，定义了需要实现的基础功能
 */
export declare abstract class BaseSocket extends Emitter {
    /**
     * 每新建一个接口+1
     */
    private static _id_Number;
    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1。
     */
    private _messageID;
    /**
     * 消息的发送队列。如果要取消发送，可以向send中传递以error
     */
    private readonly _sendingQueue;
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
    readonly readyState: ReadyState;
    /**
     * 在缓冲队列中等待发送的数据大小
     */
    readonly bufferedAmount: number;
    constructor(socket: WebSocket | WS, configs: BaseSocketConfig);
    /**
     * 需要子类覆写。用于发送数据
     */
    protected abstract _sendData(data: Buffer): Promise<void>;
    /**
     * 关闭接口。关闭之后会触发close事件
     */
    abstract close(): void;
    /**
     * 发送消息。(返回的promise中包含该条消息的messageID)
     * @param title 消息的标题
     * @param data 携带的数据
     */
    send(title: string, data: Buffer): Promise<void> & {
        messageID: number;
    };
    /**
     * 取消发送
     * @param messageID 要取消发送消息的messageID
     * @param err 传递一个error，指示取消的原因
     */
    cancel(messageID: number, err?: Error): void;
    /**
     * 解析接收到数据。子类接收到消息后需要触发这个方法
     *
     * @param data 接收到数据
     */
    protected _receiveData(data: Buffer): void;
    on(event: 'error', listener: (err: Error) => void): this;
    /**
     * 当收到消息
     */
    on(event: 'message', listener: (title: string, data: Buffer) => void): this;
    /**
     * 当连接建立
     */
    on(event: 'open', listener: () => void): this;
    /**
     * 断开连接
     */
    on(event: 'close', listener: (code: number, reason: string) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'message', listener: (title: string, data: Buffer) => void): this;
    once(event: 'open', listener: () => void): this;
    once(event: 'close', listener: (code: number, reason: string) => void): this;
}
