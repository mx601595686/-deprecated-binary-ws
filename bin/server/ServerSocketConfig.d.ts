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
