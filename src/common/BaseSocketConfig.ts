import * as WS from 'ws';

/**
 * socket 接口构造函数参数
 * 
 * @export
 * @interface BaseSocketConfig
 */
export interface BaseSocketConfig {

    /**
     * 要进行包装的socket对象
     */
    socket?: WebSocket | WS;

    /**
     * 服务器地址，默认是 ws(s)://当前域名。      
     * 注意：如果是Server生成的Socket，则url为空字符串
     */
    url: string;

    /**
     * 是否对收到的消息进行反序列化。默认true。
     */
    needDeserialize?: boolean;

    /**
     * 限制单条消息的最大大小（byte）默认100MB。     
     * 注意：这个必须与服务器一致。如果大于则会导致连接直接被断开。     
     * 注意：一条消息头部还会占据一定大小
     */
    maxPayload?: number;
}