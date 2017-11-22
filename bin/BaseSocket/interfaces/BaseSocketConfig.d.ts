/**
 * BaseSocket 构造函数参数
 *
 * @export
 * @interface BaseSocketConfig
 */
export interface BaseSocketConfig {
    /**
     * 通信地址 格式按照 ws[s]://hostname:port[/path] 的形式
     */
    url: string;
    /**
     * 限制单条消息的最大大小（byte）默认0 不限制大小。
     * 注意：这个必须与服务器一致。如果大于服务器指定的则会导致连接直接被断开。
     */
    maxPayload?: number;
}
