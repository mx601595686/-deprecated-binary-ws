import * as WS from 'ws';

/**
 * socket 接口构造函数参数
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
     * 是否对收到的消息进行反序列化。如果是作为代理服务器，关闭可以提高性能，默认true。
     */
    needDeserialize?: boolean;

    /**
     * 将要发送的消息内容的最大大小（单位Byte）。为0则表示不限制大小，默认0。       
     * 这个必须与服务器端配置一致，如果超过将直接导致连接断开。
     */
    sendingContentSize?: number;

    /**
     * 将要发送的文件的最大大小（单位Byte）。为0则表示不限制大小，默认0。       
     * 这个必须与服务器端配置一致，如果超过将直接导致连接断开。
     */
    sendingFileSize?: number;

    /**
     * 发送时会将单个文件拆成多个片段，设置每个片段的大小，默认1024*1024 byte
     */
    filePieceSize?: number;

    /**
     * 接收文件片段超时，默认：10分钟。
     */
    receivingFilePieceTimeout?: number;

    /**
     * 是否在控制台打印发出的消息，默认false
     */
    printSendingMessage?: boolean;

    /**
     * 是否在控制台打印收到的消息，默认false
     */
    printReceivedMessage?: boolean;
}