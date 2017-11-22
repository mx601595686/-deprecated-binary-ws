import * as Emitter from 'component-emitter';
import * as WS from 'ws';
import log from 'log-formatter';

import { ReadyState } from "../interfaces/ReadyState";
import { BaseSocketConfig } from '../interfaces/BaseSocketConfig';
import { SendingQueue } from './SendingQueue';
import { SendingData } from './SendingData';
import { receivingQueue } from './receivingQueue';
import { ReceivedData } from '../interfaces/ReceivedData';

/**
 * websocket 接口的抽象类，定义了需要实现的基础功能
 */
export abstract class BaseSocket extends Emitter {

    /**
     * 每新建一个接口+1
     */
    private static _id_Number = 0;

    /**
     * 保存被包装的socket对象
     */
    private readonly _socket: WebSocket | WS;

    private readonly _sendingQueue: SendingQueue = new SendingQueue(this);

    private readonly _receivingQueue: receivingQueue = new receivingQueue(this);

    /**
     * 当前接口的id
     */
    readonly id: number;

    /**
     * _messageID 的ID号，id从0开始。每发一条消息，该id加1。（内部使用）
     */
    _messageID = 0;

    readonly url: string;
    readonly needDeserialize: boolean;
    readonly sendingContentSize: number;
    readonly sendingFileSize: number;
    readonly filePieceSize: number;
    readonly receivingFilePieceTimeout: number;
    readonly printSendingMessage: boolean = false;
    readonly printReceivedMessage: boolean = false;

    /**
     * 连接的当前状态
     */
    get readyState(): ReadyState {
        return this._socket.readyState;
    }

    constructor(socket: WebSocket | WS, configs: BaseSocketConfig) {
        super();

        this.id = BaseSocket._id_Number++;

        this._socket = socket;

        this.url = configs.url;
        this.needDeserialize = configs.needDeserialize == null ? true : configs.needDeserialize;
        this.sendingContentSize = configs.sendingContentSize == null ? 0 : configs.sendingContentSize;
        this.sendingFileSize = configs.sendingFileSize == null ? 0 : configs.sendingFileSize;
        this.filePieceSize = configs.filePieceSize == null ? 1024 * 1024 : configs.filePieceSize;
        this.receivingFilePieceTimeout = configs.receivingFilePieceTimeout == null ? 10 * 60 * 1000 : configs.receivingFilePieceTimeout;
        this.printSendingMessage = configs.printSendingMessage == null ? false : configs.printSendingMessage;
        this.printReceivedMessage = configs.printReceivedMessage == null ? false : configs.printReceivedMessage;

        if (this.printSendingMessage === true) {
            const send: any = this.send;

            this.send = function (...args: any[]) {
                const sp = send(...args);

                const result = sp.then(() => {
                    log
                        .location   //binary-ws
                        .location.green // 发送成功 | 发送失败
                        .text   //destination
                        .content.yellow('binary-ws', '发送成功', args[0], args[1]);
                }).catch((err: Error) => {
                    log.error
                        .location.white
                        .location.red
                        .text
                        .text.round.red //error
                        .content.yellow('binary-ws', '发送失败', args[0], err.message, args[1]);

                    throw err;
                });

                result.messageID = sp.messageID;
                return result;
            } as any;
        }

        if (this.printReceivedMessage === true) {
            this.on('message', function (data) {
                log
                    .location
                    .location.blue
                    .content.yellow('binary-ws', '接收成功',  data.content);
            });
        }
    }

    /**
     * 需要子类覆写。用于发送数据
     */
    abstract async _sendData(data: Buffer): Promise<void>;

    /**
     * 关闭接口。关闭之后会触发close事件
     */
    abstract close(): void;

    /**
     * 发送数据。(返回的promise中包含该条消息的messageID)
     * @param destination 目的地
     * @param content 内容
     * @param file 附带文件
     * @param onUpdateSendingFilePercentage 发送文件进度回调，返回值0-1
     */
    send(destination: string, content: string, file?: Buffer, onUpdateSendingFilePercentage?: (percentage: number) => void) {
        const data = new SendingData(this, destination, content, file);

        const prom: Promise<void> & { messageID: number } = new Promise((resolve, reject) => {
            this._sendingQueue.addToSendingQueue({ data, resolve, reject, onUpdateSendingFilePercentage });
        }) as any;

        prom.messageID = data.messageID;
        return prom;
    }

    /**
     * 取消发送
     * @param messageID 要取消发送消息的messageID
     * @param err 传递一个error，指示本次发送失败的原因
     */
    cancel(messageID: number, err?: Error) {
        this._sendingQueue.cancel(messageID, err);
    }

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





    on(event: 'error', listener: (err: Error) => void): this
    /**
     * 当收到消息，并且needDeserialize设置为true
     */
    on(event: 'message', listener: (data: ReceivedData) => void): this
    /**
     * 当收到消息，并且needDeserialize设置为false，该事件会被触发，传递消息的目的地以及原始数据
     */
    on(event: 'raw-message', listener: (destination: string, data: Buffer) => void): this
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
    once(event: 'message', listener: (data: ReceivedData) => void): this
    once(event: 'raw-message', listener: (destination: string, data: Buffer) => void): this
    once(event: 'open', listener: () => void): this
    once(event: 'close', listener: (code: number, reason: string) => void): this
    once(event: string, listener: Function): this {
        super.once(event, listener);
        return this;
    }
}