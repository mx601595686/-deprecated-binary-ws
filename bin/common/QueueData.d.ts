/// <reference types="node" />
/**
 * 排队等待发送的数据
 *
 * @export
 * @interface QueueData
 */
export interface QueueData {
    /**
     * 要被发送的数据
     */
    readonly data: Buffer;
    /**
     * 本条消息的编号
     */
    readonly messageID: number;
    /**
     * 消息是否已经发送出了
     */
    sent: boolean;
    /**
     * 如果数据还没有被发送，则可以被取消。取消成功返回true，失败返回false
     *
     * @param {Error} [err] 传递一个error，指示本次发送属于失败
     *
     * @memberof QueueData
     */
    cancel: (err?: Error) => boolean;
    /**
     * 当收到接收端传回的ack消息后触发
     *
     * @param {Error} [err] 传递一个error，指示本次发送属于失败
     * @memberof QueueData
     */
    ack: (err?: Error) => void;
    /**
     * 发送数据
     *
     * @memberof QueueData
     */
    send: () => void;
}
