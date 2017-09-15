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
     * 注意：port与server不能同时指定，否则WS会在内部新建一个http server，绑定在port上，而不绑定在指定的server上了
     */
    server?: http.Server | https.Server;

    /**
     * 只接收匹配路径上的连接。默认任意地址。注意"/"只会匹配根。
     */
    path?: string;

    /**
     * 单条消息的最大大小（byte）。
     */
    maxPayload?: number;
}