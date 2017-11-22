/**
 * 内部消息类型
 */
export const enum InternalContentType {
    /**
     * 表示此段消息包含的是消息content部分
     */
    content,

    /**
     * 表示发送的是文件片段
     */
    filePiece,

    /**
     * 表示取消发送
     */
    cancelSending,

    /**
     * 请求下一个文件片段
     */
    requestNextFilePiece
}