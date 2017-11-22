import { BaseSocket } from "./BaseSocket";
import { SendingData } from "./SendingData";
import { InternalContentType } from "../interfaces/InternalContentType";
import { ReceivedData, requestFileCallback } from "../interfaces/ReceivedData";


/**
 * 消息接收队列
 */
export class receivingQueue {

    private readonly _socket: BaseSocket;

    /**
     * 接收文件回调,key:messageID
     */
    private readonly _receivingFileCallback: Map<number, { timer: NodeJS.Timer, callback: Function }> = new Map();

    constructor(socket: BaseSocket) {
        this._socket = socket;
    }

    /**
     * 将接收到的数据添加到接收队列
     */
    addToReceivingQueue(data: Buffer) {
        try {
            if (this._socket.needDeserialize) {
                const result = SendingData.deserialize(data);
                switch (result.internal.type) {
                    case InternalContentType.content:
                        const content = result.msgBody.toString();
                        const fileLength = result.internal.fileLength as number;
                        const fileSplitNumber = result.internal.fileSplitNumber as number;

                        if (fileLength > this._socket.sendingFileSize)
                            throw new Error('对方发来的文件大小超出了限制');

                        const requestFile = (callback: requestFileCallback, startIndex = 0) => {
                            if (fileLength > 0 && startIndex < fileSplitNumber) {
                                this._receivingFileCallback.set(result.internal.messageID, {
                                    timer: setTimeout(() => {

                                    }, this._socket.receivingFilePieceTimeout),
                                    callback: () => {
                                        
                                    }
                                });
                            }
                        };

                        this._socket.emit('message', { content, fileLength, fileSplitNumber, requestFile });
                        break;

                    case InternalContentType.filePiece:

                        break;

                    case InternalContentType.requestNextFilePiece:

                        break;

                    case InternalContentType.cancelSending:

                        break;

                    default:
                        this._socket.emit('error', '收到并不存在的内部消息类型');
                        break;
                }
            } else {
                this._socket.emit('raw-message', SendingData.peekDestination(data), data);
            }
        } catch (error) {
            this._socket.emit('error', error);
        }
    }
}