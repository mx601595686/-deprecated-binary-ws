/// <reference types="ws" />
/// <reference types="node" />
import { BaseSocketConfig } from './../common/BaseSocketConfig';
import { CertMeta } from "ws";
/**
 * 服务器端socket 接口构造函数参数。
 *
 * @export
 * @interface ServerSocketConfig
 * @extends {BaseSocketConfig}
 */
export interface ServerSocketConfig extends BaseSocketConfig {
    /**
     *  An object with custom headers to send along with the request.
     */
    headers?: {
        [key: string]: string;
    };
    /**
     * The certificate key.
     */
    cert?: CertMeta;
    /**
     * The private key.
     */
    key?: CertMeta;
    /**
     * The private key, certificate, and CA certs.
     */
    pfx?: string | Buffer;
    /**
     *  Trusted certificates.
     */
    ca?: CertMeta;
}
