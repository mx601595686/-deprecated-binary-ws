/**
 * 获取客户端发来的文件的回调
 */
export interface requestFileCallback {
    /**
     * @param err 是否发生错误
     * @param isFinish 是否传输结束
     * @param index 当前的文件片段序号
     * @param filePiece 文件片段
     */
    (err?: Error, isFinish?: boolean, index?: number, filePiece?: Buffer): void;
}

/**
 * 接收到的数据
 */
export interface ReceivedData {

    /**
     * 消息内容
     */
    readonly content: string;

    /**
     * 消息附带的文件大小，没有则为0
     */
    readonly fileLength: number;

    /**
     * 文件将会被分割成多少分发送过来，没有则为0
     */
    readonly fileSplitNumber: number;

    /**
     * 获取客户端发来的文件。可以传递一个startIndex,指示客户端从指定位置开始发送。
     * 
     */
    requestFile(callback: requestFileCallback, startIndex?: number): void;
}