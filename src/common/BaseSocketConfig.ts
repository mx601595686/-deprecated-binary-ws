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
     * 
     * @type {(WebSocket | WS)}
     * @memberof BaseSocketConfig
     */
    socket?: WebSocket | WS;

    /**
     * 服务器地址，默认是 ws(s)://当前域名。      
     * 注意：如果是Server生成的Socket，则url为空
     * 
     * @type {string}
     * @memberof BaseSocketConfig
     */
    url: string;

    /**
     * 是否对收到的消息进行反序列化。默认true。
     * 
     * @type {boolean}
     * @memberof BaseSocketConfig
     */
    needDeserialize?: boolean;
}