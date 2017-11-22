import { SendingData } from "../classes/SendingData";

/**
 * 要排队发送的消息
 */
export interface SendingQueueItem {
    /**
     * 要被发送的数据
     */
    readonly data: SendingData;

    /**
     * 消息是否正在发送文件（内部使用）
     */
    _sendingFile?: boolean;

    /**
     * 发送文件进度回调，返回值0-1
     */
    onUpdateSendingFilePercentage?: (percentage: number) => void;

    /**
     * promise成功回调
     */
    resolve: () => void;

    /**
     * promise失败回调
     */
    reject: (err?: Error) => void;
}