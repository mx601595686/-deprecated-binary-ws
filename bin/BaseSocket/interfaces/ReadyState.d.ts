/**
 * 描述 WebSocket 连接的状态
 *
 * @export
 * @enum {number}
 */
export declare enum ReadyState {
    /**
     * 正在连接
     */
    CONNECTING = 0,
    /**
     * 连接已开启并准备好进行通信
     */
    OPEN = 1,
    /**
     * 连接正在关闭的过程中
     */
    CLOSING = 2,
    /**
     * 连接已经关闭，或者连接无法建立
     */
    CLOSED = 3,
}
