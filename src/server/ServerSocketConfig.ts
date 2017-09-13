import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { CertMeta } from "ws";

// 注意：这里面的参数都是供‘WS’使用的，BaseSocketConfig中定义的参数不要与WS使用的参数相互冲突了

/**
 * 服务器端socket 接口构造函数参数。    
 * 
 * @export
 * @interface ServerSocketConfig
 * @extends {BaseSocketConfig}
 */
export interface ServerSocketConfig extends BaseSocketConfig {
    /**
     * The certificate key.
     * 
     * @type {CertMeta}
     * @memberof ServerSocketConfig
     */
    cert?: CertMeta;
    /**
     * The private key.
     * 
     * @type {CertMeta}
     * @memberof ServerSocketConfig
     */
    key?: CertMeta;
    /**
     * The private key, certificate, and CA certs.
     * 
     * @type {(string | Buffer)}
     * @memberof ServerSocketConfig
     */
    pfx?: string | Buffer;
    /**
     *  Trusted certificates.
     * 
     * @type {CertMeta}
     * @memberof ServerSocketConfig
     */
    ca?: CertMeta;
}