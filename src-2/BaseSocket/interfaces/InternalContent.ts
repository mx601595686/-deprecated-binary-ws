import { InternalContentType } from "./InternalContentType";

/**
 * 内部消息的内容格式
 */
export interface InternalContent {
    /**
     * 消息的编号
     */
    messageID: number;

    /**
     * 消息包含内容的类型
     */
    type: InternalContentType;

    /**
     * 包含文件的长度
     */
    fileLength?: number;

    /**
     * 文件分割的数量
     */
    fileSplitNumber?: number;

    /**
     * 指示第几个文件片段，从0开始
     */
    fileSplitIndex?: number;
}

