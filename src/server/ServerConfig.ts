import * as http from 'http';
import * as https from 'https';

/**
 * Server构造函数配置
 */
export interface ServerConfig {
    /**
     * 要绑定的主机地址。默认0.0.0.0
     */
    host?: string;

    /**
     * 要绑定的端口。默认8080
     */
    port?: number;

    /**
     * 绑定在一个预先创建好的http服务器上。    
     * 注意：如果指定了server，那么host与port将无效
     */
    server?: http.Server | https.Server;

    /**
     * 只接收匹配路径上的连接。默认任意地址。注意"/"只会匹配根。
     */
    path?: string;

    /**
     * 接受的单条消息的最大大小（byte）。
     */
    maxPayload?: number;

    /**
     * 是否对收到的消息进行反序列化。默认true。
     * 
     * @type {boolean}
     * @memberof BaseSocketConfig
     */
    needDeserialize?: boolean;
}