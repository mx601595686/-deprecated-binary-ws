/**
 * socket 接口构造函数参数
 * 
 * @export
 * @interface BaseSocketConfig
 */
export interface BaseSocketConfig {
    /**
     * 服务器地址，默认是 ws(s)://当前域名。      
     * 注意：如果是Server生成的Socket，则url为空
     * 
     * @type {string}
     * @memberof BaseSocketConfig
     */
    url: string,

    /**
     * 发送数据超时。默认1分钟。这个只针对needACK的消息才有效
     * 
     * @type {number}
     * @memberof BaseSocketConfig
     */
    sendingTimeout?: number;

    /**
     * 发送失败尝试重发的次数，默认3。这个只针对needACK的消息才有效（重发不会导致接收端收到重复的数据）
     * 
     * @type {number}
     * @memberof BaseSocketConfig
     */
    sendingRetry?: number;

    /**
     * 是否对收到的消息进行反序列化。默认true
     * 
     * @type {boolean}
     * @memberof BaseSocketConfig
     */
    needDeserialize?: boolean;
}