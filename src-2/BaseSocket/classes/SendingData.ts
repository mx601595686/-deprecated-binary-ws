import { InternalContent } from './../interfaces/InternalContent';
import { BaseSocket } from "./BaseSocket";
import { InternalContentType } from '../interfaces/InternalContentType';

/**
 * 包装将要被发送的数据。    
 * 消息是由 [destination, internalContent, content | filePiece]组成的。
 * 一条消息将分多次发送，第一次发送destination, internalContent, content，其中internalContent包含了关于文件的信息。
 * 之后按照BaseSocket.filePieceSize的要求将文件划分成多个小块分多次发送，
 * 每次包含destination, internalContent, filePiece，其中internalContent包含了关于filePiece的编号。
 */
export class SendingData {

    private readonly _socket: BaseSocket;

    readonly destination: Buffer;
    readonly content: Buffer;
    readonly file: Buffer;
    readonly fileSplitNumber: number;  //文件将会被分割成多少分
    readonly messageID: number;

    /**
     * @param socket 
     * @param messageID 消息编号
     * @param destination 消息发送的目的地
     * @param content 消息内容
     * @param file 消息附加的文件。
     */
    constructor(socket: BaseSocket, destination: string, content: string, file?: Buffer) {
        this._socket = socket;
        this.messageID = socket._messageID++;
        this.destination = Buffer.from(destination);
        this.content = Buffer.from(content);
        this.file = file || Buffer.alloc(0);
        this.fileSplitNumber = this.file.length && Math.ceil(this.file.length / socket.filePieceSize);

        if (socket.sendingContentSize != 0 && this.content.length > socket.sendingContentSize)
            throw new Error('消息content超过了大小限制');

        if (socket.sendingFileSize != 0 && this.file.length > socket.sendingFileSize)
            throw new Error('消息file超过了大小限制');
    }

    /**
     * 获取消息content部分数据包
     */
    getContentPackage(): Buffer {
        const internalContent: InternalContent = {
            messageID: this.messageID,
            type: InternalContentType.content,
            fileLength: this.file.length,
            fileSplitNumber: this.fileSplitNumber
        }

        return SendingData.serialize(this.destination, internalContent, this.content);
    }

    /**
     * 获取文件片段数据包
     * @param index 索引号
     */
    getFilePiecePackage(index: number): Buffer {
        if (index < 0)
            throw new Error('消息文件片段索引号不可以小于0');

        if (index >= this.fileSplitNumber)
            throw new Error('消息文件片段索引号超出了边界');

        const internalContent: InternalContent = {
            messageID: this.messageID,
            type: InternalContentType.filePiece,
            fileSplitIndex: index
        }

        const f_start = index * this._socket.filePieceSize;
        let f_end = f_start + this._socket.filePieceSize;
        if (f_end > this.file.length) f_end = this.file.length;

        const filePiece = this.file.slice(f_start, f_end);

        return SendingData.serialize(this.destination, internalContent, filePiece);
    }

    /**
     * 获取取消发送数据包
     */
    getCancelSendingPackage(): Buffer {
        const internalContent: InternalContent = {
            messageID: this.messageID,
            type: InternalContentType.cancelSending
        }

        return SendingData.serialize(this.destination, internalContent, Buffer.alloc(0));
    }

    /**
     * 序列化消息
     */
    static serialize(destination: Buffer, internal: InternalContent, msgBody: Buffer): Buffer {
        const dest_length = Buffer.alloc(4);
        dest_length.writeUInt32BE(destination.length, 0);

        const b_internal = Buffer.from(JSON.stringify(internal));
        const internal_length = Buffer.alloc(4);
        internal_length.writeUInt32BE(b_internal.length, 0);

        const msgBody_length = Buffer.alloc(4);
        msgBody_length.writeUInt32BE(msgBody.length, 0);

        return Buffer.concat([
            dest_length, destination,
            internal_length, b_internal,
            msgBody_length, msgBody
        ]);
    }

    /**
     * 反序列化消息。（注意异常捕捉）
     */
    static deserialize(data: Buffer) {
        let offset = 0;

        const dest_length = data.readUInt32BE(offset); offset += 4;
        const destination = data.slice(offset, offset += dest_length).toString();

        const internal_length = data.readUInt32BE(offset); offset += 4;
        const internal: InternalContent = JSON.parse(data.slice(offset, offset += dest_length).toString());

        const msgBody_length = data.readUInt32BE(offset); offset += 4;
        const msgBody = data.slice(offset, offset += dest_length);

        return {
            destination,
            internal,
            msgBody
        };
    }

    /**
     * 不反序列化消息，仅仅瞧一下消息的目的地。（注意异常捕捉）
     */
    static peekDestination(data: Buffer) {
        const dest_length = data.readUInt32BE(0);
        const destination = data.slice(0, dest_length).toString();

        return destination;
    }

    static getRequestNextFilePiecePackage(){}
}