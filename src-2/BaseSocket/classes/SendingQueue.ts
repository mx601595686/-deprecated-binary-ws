import { SendingData } from './SendingData';
import { SendingQueueItem } from '../interfaces/SendingQueueItem';
import { BaseSocket } from './BaseSocket';

/**
 * 排队等待发送的数据
 */
export class SendingQueue {

    /**
     * 将要被发送的消息。(被发送的消息会被分成小块，放到_queue中等待被发送)     
     * key：messageID。
     */
    private readonly _sendingDataList: Map<number, SendingQueueItem> = new Map();

    /**
     * 等待发送的数据队列。key：messageID。value: 发送数据的方法
     */
    private readonly _queue: Map<number, Function> = new Map();

    private readonly _socket: BaseSocket;

    constructor(socket: BaseSocket) {
        this._socket = socket;

        socket.once('close', () => {    //如果断开，终止所有还未发送的消息。从后向前取消
            for (let item of [...this._sendingDataList.values()].reverse())
                this.cancel(item.data.messageID, new Error('连接中断'));
        });
    }

    /**
     * 取消发送,可以传递一个error说明一下原因
     */
    cancel(messageID: number, err: Error = new Error('取消发送')) {
        const item = this._sendingDataList.get(messageID);
        if (item != null) {
            item.reject(err);
            this._sendingDataList.delete(messageID);
            this._queue.delete(messageID);
            item._sendingFile && this._addToQueue(messageID, item.data.getCancelSendingPackage());  //如果正在发送文件，通知接收方发送取消
        }
    }

    /**
     * 将要发送的消息添加到发送队列中
     */
    addToSendingQueue(item: SendingQueueItem) {
        if (this._sendingDataList.has(item.data.messageID))
            throw new Error(`重复发送消息：${item.data.messageID}`);

        item._sendingFile = false;
        this._sendingDataList.set(item.data.messageID, item);

        this._sendContent(item.data.messageID);
    }

    /**
     * 发送消息content部分
     */
    private _sendContent(messageID: number) {
        const item = this._sendingDataList.get(messageID);
        if (item != null) {
            if (item.data.file.length === 0) { //如果不包含文件，发送后直接通知发送结束
                this._addToQueue(messageID, item.data.getContentPackage(), err => {
                    err ? item.reject(err) : item.resolve();
                    this._sendingDataList.delete(messageID);
                });
            } else {
                this._addToQueue(messageID, item.data.getContentPackage(), err => {
                    item._sendingFile = true;
                    err != null && this.cancel(messageID, err); //发送失败通知接收方，发送文件取消
                });
            }
        }
    }

    /**
     * 添加到数据队列中
     */
    private _addToQueue(messageID: number, data: Buffer, onFinish = (err?: Error) => { }) {
        if (this._queue.has(messageID))
            throw new Error(`重复添加发送数据包：${messageID}`);

        const send = () => {
            this._socket._sendData(data)
                .then(onFinish as any)
                .catch(onFinish)
                .then(() => {
                    this._queue.delete(messageID);
                    if (this._queue.size > 0) this._queue.values().next().value();
                });
        };

        this._queue.set(messageID, send);
        this._queue.size === 1 && send();
    }

    /**
     * 发送文件片段
     */
    sendFilePiece(messageID: number, index: number) {
        const item = this._sendingDataList.get(messageID);
        if (item != null && item.data.fileSplitNumber > index) {
            this._addToQueue(messageID, item.data.getFilePiecePackage(index), err => {
                if (err == null) {
                    item.onUpdateSendingFilePercentage && item.onUpdateSendingFilePercentage((index + 1) / item.data.fileSplitNumber);
                    index === item.data.fileSplitNumber - 1 && item.resolve();  //最后一个文件片段发出之后就通知发送成功了
                } else {
                    this.cancel(messageID, err);
                }
            });
        }
    }
}