"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Emitter = require("component-emitter");
const _Buffer = Buffer ? Buffer : require('buffer/').Buffer; // 确保浏览器下也能使用Buffer
const isBuffer = require('is-buffer');
/**
 * Socket 接口的抽象类，定义了socket需要实现的基础功能
 */
class BaseSocket extends Emitter {
    /**
     * @param {(WebSocket|WS)} socket 子类实例化的socket对象
     * @param {("browser" | "node")} platform 指示该接口所处的平台
     * @param {BaseSocketConfig} configs 配置
     * @memberof BaseSocket
     */
    constructor(socket, platform, configs) {
        super();
        /**
         * _messageID 的ID号，id从0开始。每发一条消息，该id加1
         *
         * @private
         * @memberof BaseSocket
         */
        this._messageID = 0;
        /**
         * 等待发送消息的队列。key：messageID。
         */
        this._queue = new Map();
        this.url = configs.url;
        this._needDeserialize = configs.needDeserialize === undefined ? true : configs.needDeserialize;
        this.socket = socket;
        this.platform = platform;
        this.on('close', () => {
            for (let item of this._queue.values()) {
                item.cancel(new Error('连接中断'));
            }
        });
    }
    /**
     * 连接的当前状态
     *
     * @readonly
     * @abstract
     * @type {ReadyState}
     * @memberof BaseSocket
     */
    get readyState() {
        return this.socket.readyState;
    }
    /**
     * 在缓冲队列中等待发送的数据字节数
     *
     * @readonly
     * @abstract
     * @type {number}
     * @memberof BaseSocket
     */
    get bufferedAmount() {
        let size = 0;
        for (let item of this._queue.values()) {
            size += item.data.length;
        }
        return size;
    }
    /**
     * 对要发送的数据进行序列化。注意只有位于数组根下的boolean、string、number、void、Buffer才会进行二进制序列化，对象会被JSON.stringify
     * 数据格式： 元素类型 -> [元素长度] -> 元素内容
     *
     * @static
     * @memberof BaseSocket
     */
    static serialize(data) {
        const bufferItems = [];
        for (let item of data) {
            switch (typeof item) {
                case 'number': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.alloc(8);
                    type.writeUInt8(0 /* number */, 0);
                    content.writeDoubleBE(item, 0);
                    bufferItems.push(type, content);
                    break;
                }
                case 'string': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.from(item);
                    const contentLength = _Buffer.alloc(8);
                    type.writeUInt8(1 /* string */, 0);
                    contentLength.writeDoubleBE(content.length, 0);
                    bufferItems.push(type, contentLength, content);
                    break;
                }
                case 'boolean': {
                    const type = _Buffer.alloc(1);
                    const content = _Buffer.alloc(1);
                    type.writeUInt8(2 /* boolean */, 0);
                    content.writeUInt8(item ? 1 : 0, 0);
                    bufferItems.push(type, content);
                    break;
                }
                case 'undefined': {
                    const type = _Buffer.alloc(1);
                    type.writeUInt8(4 /* undefined */, 0);
                    bufferItems.push(type);
                    break;
                }
                case 'object': {
                    if (item === null) {
                        const type = _Buffer.alloc(1);
                        type.writeUInt8(3 /* null */, 0);
                        bufferItems.push(type);
                    }
                    else if (isBuffer(item)) {
                        const type = _Buffer.alloc(1);
                        const content = item;
                        const contentLength = _Buffer.alloc(8);
                        type.writeUInt8(6 /* Buffer */, 0);
                        contentLength.writeDoubleBE(content.length, 0);
                        bufferItems.push(type, contentLength, content);
                    }
                    else {
                        const type = _Buffer.alloc(1);
                        const content = _Buffer.from(JSON.stringify(item));
                        const contentLength = _Buffer.alloc(8);
                        type.writeUInt8(5 /* Object */, 0);
                        contentLength.writeDoubleBE(content.length, 0);
                        bufferItems.push(type, contentLength, content);
                    }
                }
            }
        }
        return _Buffer.concat(bufferItems);
    }
    /**
     * 对接收到的消息进行反序列化
     *
     * @static
     * @param {Buffer} data
     * @memberof BaseSocket
     */
    static deserialize(data) {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');
        let previous = 0;
        const result = [];
        while (previous < data.length) {
            const type = data.readUInt8(previous++);
            switch (type) {
                case 0 /* number */: {
                    result.push(data.readDoubleBE(previous));
                    previous += 8;
                    break;
                }
                case 1 /* string */: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;
                    const content = data.slice(previous, previous += length);
                    result.push(content.toString());
                    break;
                }
                case 2 /* boolean */: {
                    const content = data.readUInt8(previous++);
                    result.push(content === 1);
                    break;
                }
                case 4 /* undefined */: {
                    result.push(undefined);
                    break;
                }
                case 3 /* null */: {
                    result.push(null);
                    break;
                }
                case 6 /* Buffer */: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;
                    result.push(data.slice(previous, previous += length));
                    break;
                }
                case 5 /* Object */: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;
                    const content = data.slice(previous, previous += length);
                    result.push(JSON.parse(content.toString()));
                    break;
                }
                default: {
                    throw new Error('data type don`t exist. type: ' + type);
                }
            }
        }
        return result;
    }
    /**
     * 序列化消息头部。
     * 数据格式：头部长度 -> 是否是内部消息 -> 消息名称长度 -> 消息名称 -> 该消息是否需要确认收到 -> 消息id
     *
     * @private
     * @param {boolean} isInternal 是否是内部消息
     * @param {string} messageName 消息的名称
     * @param {boolean} needACK
     * @param {number} messageID
     * @returns {Buffer}
     * @memberof BaseSocket
     */
    _serializeHeader(isInternal, messageName, needACK, messageID) {
        let _headerLength = _Buffer.alloc(8);
        let _isInternal = _Buffer.alloc(1);
        let _messageNameLength = _Buffer.alloc(8);
        let _messageName = _Buffer.from(messageName);
        let _needACK = _Buffer.alloc(1);
        let _messageID = _Buffer.alloc(8);
        _isInternal.writeUInt8(isInternal ? 1 : 0, 0);
        _messageNameLength.writeDoubleBE(_messageName.length, 0);
        _needACK.writeUInt8(needACK ? 1 : 0, 0);
        _messageID.writeDoubleBE(messageID, 0);
        let length = _headerLength.length + _isInternal.length + _messageName.length + _messageNameLength.length + _needACK.length + _messageID.length;
        _headerLength.writeDoubleBE(length, 0);
        return Buffer.concat([_headerLength, _isInternal, _messageNameLength, _messageName, _needACK, _messageID], length);
    }
    /**
     * 反序列化头部
     * @param data 头部二进制数据
     */
    _deserializeHeader(data) {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');
        const header = {
            isInternal: true,
            messageName: '',
            needACK: false,
            messageID: -1,
            headerLength: 0
        };
        header.headerLength = data.readDoubleBE(0);
        let index = 8;
        header.isInternal = data.readUInt8(index++) === 1;
        const messageNameLength = data.readDoubleBE(index);
        index += 8;
        header.messageName = data.slice(index, index += messageNameLength).toString();
        header.needACK = data.readUInt8(index++) === 1;
        header.messageID = data.readDoubleBE(index);
        return header;
    }
    /**
     * 发送数据。发送失败直接抛出异常
     *
     * @param {string} messageName 消息的名称(标题)
     * @param {(any[] | Buffer)} [data=[]] 要发送的数据。如果是传入的是数组，则数据将使用BaseSocket.serialize() 进行序列化。如果传入的是Buffer，则将直接被发送。
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @returns {(Promise<void> & { messageID: number })} messageID
     * @memberof BaseSocket
     */
    send(messageName, data = [], needACK = true) {
        return this._send(false, messageName, needACK, data);
    }
    /**
      * 发送内部数据。发送失败直接抛出异常。内部数据默认不需要接收端确认
      * 注意：要在每一个调用的地方做好异常处理
      */
    _sendInternal(messageName, data = [], needACK = false) {
        return this._send(true, messageName, needACK, data);
    }
    _send(isInternal, messageName, needACK, data) {
        const msgID = this._messageID++;
        const prom = new Promise((resolve, reject) => {
            const header = this._serializeHeader(isInternal, messageName, needACK, msgID);
            const body = Array.isArray(data) ? BaseSocket.serialize(data) : data;
            const sendingData = _Buffer.concat([header, body]);
            const control = {
                data: sendingData,
                messageID: msgID,
                cancel: (err) => {
                    if (this._queue.values().next().value === control)
                        return false;
                    else {
                        this._queue.delete(msgID);
                        err ? reject(err) : resolve();
                        return true;
                    }
                },
                send: () => {
                    if (needACK) {
                        this._sendData(sendingData).catch(control.ack);
                    }
                    else {
                        this._sendData(sendingData).then(control.ack).catch(control.ack);
                    }
                },
                ack: (err) => {
                    this._queue.delete(msgID);
                    err ? reject(err) : resolve();
                    if (this._queue.size > 0)
                        this._queue.values().next().value.send();
                }
            };
            this._queue.set(msgID, control); //添加到队列中
            if (this._queue.size === 1) {
                control.send();
            }
        });
        prom.messageID = msgID;
        return prom;
    }
    /**
     * 解析接收到数据。子类接收到消息后需要触发这个方法
     *
     * @private
     * @param {Buffer} data 接收到数据
     * @memberof BaseSocket
     */
    _receiveData(data) {
        const header = this._deserializeHeader(data);
        console.log(header);
        if (header.needACK)
            this._sendInternal('ack', [header.messageID]).catch(err => this.emit('error', err));
        if (header.isInternal) {
            const body = BaseSocket.deserialize(data.slice(header.headerLength));
            switch (header.messageName) {
                case 'ack':
                    const callback = this._queue.get(body[0]);
                    callback && callback.ack();
                    break;
            }
        }
        else {
            const body = this._needDeserialize ? BaseSocket.deserialize(data.slice(header.headerLength)) : data.slice(header.headerLength);
            this.emit('message', header.messageName, body);
        }
    }
    /**
     * 取消发送。如果某条消息还没有被取消则可以被取消。取消成功返回true，失败false
     *
     * @param {number} messageID 要取消发送消息的messageID
     * @param {Error} [err] 传递一个error，指示本次发送属于失败
     * @returns {boolean} 取消成功返回true，失败false
     * @memberof BaseSocket
     */
    cancel(messageID, err) {
        const control = this._queue.get(messageID);
        if (control) {
            return control.cancel(err);
        }
        return false;
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
    once(event, listener) {
        super.once(event, listener);
        return this;
    }
}
exports.BaseSocket = BaseSocket;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsSUFBSSxDQUFDLENBQUM7WUFDSixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQy9ILElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsTUFBTSxDQUFDLFNBQWlCLEVBQUUsR0FBVztRQUNqQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUUzQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ1YsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQXdCRCxFQUFFLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2hDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQVlELElBQUksQ0FBQyxLQUFhLEVBQUUsUUFBa0I7UUFDbEMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDNUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0NBQ0o7QUF4ZEQsZ0NBd2RDIiwiZmlsZSI6ImNvbW1vbi9CYXNlU29ja2V0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgRW1pdHRlciBmcm9tICdjb21wb25lbnQtZW1pdHRlcic7XHJcbmltcG9ydCAqIGFzIFdTIGZyb20gJ3dzJztcclxuY29uc3QgX0J1ZmZlcjogdHlwZW9mIEJ1ZmZlciA9IEJ1ZmZlciA/IEJ1ZmZlciA6IHJlcXVpcmUoJ2J1ZmZlci8nKS5CdWZmZXI7ICAvLyDnoa7kv53mtY/op4jlmajkuIvkuZ/og73kvb/nlKhCdWZmZXJcclxuY29uc3QgaXNCdWZmZXIgPSByZXF1aXJlKCdpcy1idWZmZXInKTtcclxuXHJcbmltcG9ydCB7IFJlYWR5U3RhdGUgfSBmcm9tIFwiLi9SZWFkeVN0YXRlXCI7XHJcbmltcG9ydCB7IEJhc2VTb2NrZXRDb25maWcgfSBmcm9tICcuL0Jhc2VTb2NrZXRDb25maWcnO1xyXG5pbXBvcnQgeyBEYXRhVHlwZSB9IGZyb20gJy4uL2NvbW1vbi9EYXRhVHlwZSc7XHJcbmltcG9ydCB7IFF1ZXVlRGF0YSB9IGZyb20gJy4vUXVldWVEYXRhJztcclxuXHJcbi8qKlxyXG4gKiBTb2NrZXQg5o6l5Y+j55qE5oq96LGh57G777yM5a6a5LmJ5LqGc29ja2V06ZyA6KaB5a6e546w55qE5Z+656GA5Yqf6IO9XHJcbiAqL1xyXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVNvY2tldCBleHRlbmRzIEVtaXR0ZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogX21lc3NhZ2VJRCDnmoRJROWPt++8jGlk5LuOMOW8gOWni+OAguavj+WPkeS4gOadoea2iOaBr++8jOivpWlk5YqgMVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfbWVzc2FnZUlEID0gMDtcclxuXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9uZWVkRGVzZXJpYWxpemU6IGJvb2xlYW47XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnrYnlvoXlj5HpgIHmtojmga/nmoTpmJ/liJfjgIJrZXnvvJptZXNzYWdlSUTjgIJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfcXVldWU6IE1hcDxudW1iZXIsIFF1ZXVlRGF0YT4gPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDkv53lrZjooqvljIXoo4XnmoRzb2NrZXTlr7nosaFcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUgeyhXZWJTb2NrZXR8V1MpfVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcmVhZG9ubHkgc29ja2V0OiBXZWJTb2NrZXQgfCBXUztcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdlYlNvY2tldCBzZXJ2ZXIg55qEVVJM5Zyw5Z2AICAgXHJcbiAgICAgKiDms6jmhI/vvJrlpoLmnpzmmK9TZXJ2ZXLnlJ/miJDnmoRTb2NrZXTvvIzliJl1cmzkuLrnqbrlrZfnrKbkuLJcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IHVybDogc3RyaW5nO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5b2T5YmN5o6l5Y+j6L+Q6KGM5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBcclxuICAgICAqIEB0eXBlIHsoXCJicm93c2VyXCIgfCBcIm5vZGVcIil9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBwbGF0Zm9ybTogXCJicm93c2VyXCIgfCBcIm5vZGVcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOi/nuaOpeeahOW9k+WJjeeKtuaAgVxyXG4gICAgICogXHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHR5cGUge1JlYWR5U3RhdGV9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBnZXQgcmVhZHlTdGF0ZSgpOiBSZWFkeVN0YXRlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zb2NrZXQucmVhZHlTdGF0ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWcqOe8k+WGsumYn+WIl+S4reetieW+heWPkemAgeeahOaVsOaNruWtl+iKguaVsFxyXG4gICAgICogXHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHR5cGUge251bWJlcn1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIGdldCBidWZmZXJlZEFtb3VudCgpOiBudW1iZXIge1xyXG4gICAgICAgIGxldCBzaXplID0gMDtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiB0aGlzLl9xdWV1ZS52YWx1ZXMoKSkge1xyXG4gICAgICAgICAgICBzaXplICs9IGl0ZW0uZGF0YS5sZW5ndGg7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gc2l6ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEBwYXJhbSB7KFdlYlNvY2tldHxXUyl9IHNvY2tldCDlrZDnsbvlrp7kvovljJbnmoRzb2NrZXTlr7nosaFcclxuICAgICAqIEBwYXJhbSB7KFwiYnJvd3NlclwiIHwgXCJub2RlXCIpfSBwbGF0Zm9ybSDmjIfnpLror6XmjqXlj6PmiYDlpITnmoTlubPlj7BcclxuICAgICAqIEBwYXJhbSB7QmFzZVNvY2tldENvbmZpZ30gY29uZmlncyDphY3nva5cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHNvY2tldDogV2ViU29ja2V0IHwgV1MsIHBsYXRmb3JtOiBcImJyb3dzZXJcIiB8IFwibm9kZVwiLCBjb25maWdzOiBCYXNlU29ja2V0Q29uZmlnKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy51cmwgPSBjb25maWdzLnVybDtcclxuICAgICAgICB0aGlzLl9uZWVkRGVzZXJpYWxpemUgPSBjb25maWdzLm5lZWREZXNlcmlhbGl6ZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGNvbmZpZ3MubmVlZERlc2VyaWFsaXplO1xyXG4gICAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xyXG4gICAgICAgIHRoaXMucGxhdGZvcm0gPSBwbGF0Zm9ybTtcclxuXHJcbiAgICAgICAgdGhpcy5vbignY2xvc2UnLCAoKSA9PiB7ICAgIC8v5aaC5p6c5pat5byA77yM57uI5q2i5omA5pyJ6L+Y5pyq5Y+R6YCB55qE5raI5oGvXHJcbiAgICAgICAgICAgIGZvciAobGV0IGl0ZW0gb2YgdGhpcy5fcXVldWUudmFsdWVzKCkpIHtcclxuICAgICAgICAgICAgICAgIGl0ZW0uY2FuY2VsKG5ldyBFcnJvcign6L+e5o6l5Lit5patJykpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlr7nopoHlj5HpgIHnmoTmlbDmja7ov5vooYzluo/liJfljJbjgILms6jmhI/lj6rmnInkvY3kuo7mlbDnu4TmoLnkuIvnmoRib29sZWFu44CBc3RyaW5n44CBbnVtYmVy44CBdm9pZOOAgUJ1ZmZlcuaJjeS8mui/m+ihjOS6jOi/m+WItuW6j+WIl+WMlu+8jOWvueixoeS8muiiq0pTT04uc3RyaW5naWZ5ICAgIFxyXG4gICAgICog5pWw5o2u5qC85byP77yaIOWFg+e0oOexu+WeiyAtPiBb5YWD57Sg6ZW/5bqmXSAtPiDlhYPntKDlhoXlrrlcclxuICAgICAqIFxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNlcmlhbGl6ZShkYXRhOiBhbnlbXSk6IEJ1ZmZlciB7XHJcbiAgICAgICAgY29uc3QgYnVmZmVySXRlbXM6IEJ1ZmZlcltdID0gW107XHJcblxyXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgZGF0YSkge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuYWxsb2MoOCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5udW1iZXIsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQud3JpdGVEb3VibGVCRShpdGVtLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gX0J1ZmZlci5mcm9tKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUuc3RyaW5nLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gX0J1ZmZlci5hbGxvYygxKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLmJvb2xlYW4sIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQud3JpdGVVSW50OChpdGVtID8gMSA6IDAsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSAndW5kZWZpbmVkJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS51bmRlZmluZWQsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSAnb2JqZWN0Jzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUubnVsbCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBpdGVtO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5CdWZmZXIsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLk9iamVjdCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9CdWZmZXIuY29uY2F0KGJ1ZmZlckl0ZW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWvueaOpeaUtuWIsOeahOa2iOaBr+i/m+ihjOWPjeW6j+WIl+WMllxyXG4gICAgICogXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBkZXNlcmlhbGl6ZShkYXRhOiBCdWZmZXIpOiBhbnlbXSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgbGV0IHByZXZpb3VzID0gMDtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHByZXZpb3VzIDwgZGF0YS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bWJlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuc3RyaW5nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnNsaWNlKHByZXZpb3VzLCBwcmV2aW91cyArPSBsZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLmJvb2xlYW46IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS5yZWFkVUludDgocHJldmlvdXMrKyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goY29udGVudCA9PT0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLnVuZGVmaW5lZDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bGw6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuQnVmZmVyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5PYmplY3Q6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShwcmV2aW91cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goSlNPTi5wYXJzZShjb250ZW50LnRvU3RyaW5nKCkpKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RhdGEgdHlwZSBkb25gdCBleGlzdC4gdHlwZTogJyArIHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqP5YiX5YyW5raI5oGv5aS06YOo44CCICAgIFxyXG4gICAgICog5pWw5o2u5qC85byP77ya5aS06YOo6ZW/5bqmIC0+IOaYr+WQpuaYr+WGhemDqOa2iOaBryAtPiDmtojmga/lkI3np7Dplb/luqYgLT4g5raI5oGv5ZCN56ewIC0+IOivpea2iOaBr+aYr+WQpumcgOimgeehruiupOaUtuWIsCAtPiDmtojmga9pZFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc0ludGVybmFsIOaYr+WQpuaYr+WGhemDqOa2iOaBr1xyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VOYW1lIOa2iOaBr+eahOWQjeensFxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBuZWVkQUNLIFxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1lc3NhZ2VJRFxyXG4gICAgICogQHJldHVybnMge0J1ZmZlcn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9zZXJpYWxpemVIZWFkZXIoaXNJbnRlcm5hbDogYm9vbGVhbiwgbWVzc2FnZU5hbWU6IHN0cmluZywgbmVlZEFDSzogYm9vbGVhbiwgbWVzc2FnZUlEOiBudW1iZXIpOiBCdWZmZXIge1xyXG4gICAgICAgIGxldCBfaGVhZGVyTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX2lzSW50ZXJuYWwgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZU5hbWVMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZU5hbWUgPSBfQnVmZmVyLmZyb20obWVzc2FnZU5hbWUpO1xyXG4gICAgICAgIGxldCBfbmVlZEFDSyA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgbGV0IF9tZXNzYWdlSUQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICBfaXNJbnRlcm5hbC53cml0ZVVJbnQ4KGlzSW50ZXJuYWwgPyAxIDogMCwgMCk7XHJcbiAgICAgICAgX21lc3NhZ2VOYW1lTGVuZ3RoLndyaXRlRG91YmxlQkUoX21lc3NhZ2VOYW1lLmxlbmd0aCwgMCk7XHJcbiAgICAgICAgX25lZWRBQ0sud3JpdGVVSW50OChuZWVkQUNLID8gMSA6IDAsIDApO1xyXG4gICAgICAgIF9tZXNzYWdlSUQud3JpdGVEb3VibGVCRShtZXNzYWdlSUQsIDApO1xyXG5cclxuICAgICAgICBsZXQgbGVuZ3RoID0gX2hlYWRlckxlbmd0aC5sZW5ndGggKyBfaXNJbnRlcm5hbC5sZW5ndGggKyBfbWVzc2FnZU5hbWUubGVuZ3RoICsgX21lc3NhZ2VOYW1lTGVuZ3RoLmxlbmd0aCArIF9uZWVkQUNLLmxlbmd0aCArIF9tZXNzYWdlSUQubGVuZ3RoO1xyXG4gICAgICAgIF9oZWFkZXJMZW5ndGgud3JpdGVEb3VibGVCRShsZW5ndGgsIDApO1xyXG5cclxuICAgICAgICByZXR1cm4gQnVmZmVyLmNvbmNhdChbX2hlYWRlckxlbmd0aCwgX2lzSW50ZXJuYWwsIF9tZXNzYWdlTmFtZUxlbmd0aCwgX21lc3NhZ2VOYW1lLCBfbmVlZEFDSywgX21lc3NhZ2VJRF0sIGxlbmd0aCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj43luo/liJfljJblpLTpg6hcclxuICAgICAqIEBwYXJhbSBkYXRhIOWktOmDqOS6jOi/m+WItuaVsOaNrlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kZXNlcmlhbGl6ZUhlYWRlcihkYXRhOiBCdWZmZXIpIHtcclxuICAgICAgICBpZiAoIWlzQnVmZmVyKGRhdGEpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+S8oOWFpeeahOaVsOaNruexu+Wei+S4jeaYr0J1ZmZlcicpO1xyXG5cclxuICAgICAgICBjb25zdCBoZWFkZXIgPSB7XHJcbiAgICAgICAgICAgIGlzSW50ZXJuYWw6IHRydWUsXHJcbiAgICAgICAgICAgIG1lc3NhZ2VOYW1lOiAnJyxcclxuICAgICAgICAgICAgbmVlZEFDSzogZmFsc2UsXHJcbiAgICAgICAgICAgIG1lc3NhZ2VJRDogLTEsXHJcbiAgICAgICAgICAgIGhlYWRlckxlbmd0aDogMFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGhlYWRlci5oZWFkZXJMZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRSgwKTtcclxuICAgICAgICBsZXQgaW5kZXggPSA4O1xyXG5cclxuICAgICAgICBoZWFkZXIuaXNJbnRlcm5hbCA9IGRhdGEucmVhZFVJbnQ4KGluZGV4KyspID09PSAxO1xyXG5cclxuICAgICAgICBjb25zdCBtZXNzYWdlTmFtZUxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKGluZGV4KTtcclxuICAgICAgICBpbmRleCArPSA4O1xyXG5cclxuICAgICAgICBoZWFkZXIubWVzc2FnZU5hbWUgPSBkYXRhLnNsaWNlKGluZGV4LCBpbmRleCArPSBtZXNzYWdlTmFtZUxlbmd0aCkudG9TdHJpbmcoKTtcclxuXHJcbiAgICAgICAgaGVhZGVyLm5lZWRBQ0sgPSBkYXRhLnJlYWRVSW50OChpbmRleCsrKSA9PT0gMTtcclxuXHJcbiAgICAgICAgaGVhZGVyLm1lc3NhZ2VJRCA9IGRhdGEucmVhZERvdWJsZUJFKGluZGV4KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGhlYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWPkemAgeaVsOaNruOAguWPkemAgeWksei0peebtOaOpeaKm+WHuuW8guW4uFxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZU5hbWUg5raI5oGv55qE5ZCN56ewKOagh+mimClcclxuICAgICAqIEBwYXJhbSB7KGFueVtdIHwgQnVmZmVyKX0gW2RhdGE9W11dIOimgeWPkemAgeeahOaVsOaNruOAguWmguaenOaYr+S8oOWFpeeahOaYr+aVsOe7hO+8jOWImeaVsOaNruWwhuS9v+eUqEJhc2VTb2NrZXQuc2VyaWFsaXplKCkg6L+b6KGM5bqP5YiX5YyW44CC5aaC5p6c5Lyg5YWl55qE5pivQnVmZmVy77yM5YiZ5bCG55u05o6l6KKr5Y+R6YCB44CCXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtuZWVkQUNLPXRydWVdIOWPkeWHuueahOi/meadoea2iOaBr+aYr+WQpumcgOimgeehruiupOWvueaWueaYr+WQpuW3sue7j+aUtuWIsFxyXG4gICAgICogQHJldHVybnMgeyhQcm9taXNlPHZvaWQ+ICYgeyBtZXNzYWdlSUQ6IG51bWJlciB9KX0gbWVzc2FnZUlEXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBzZW5kKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdIHwgQnVmZmVyID0gW10sIG5lZWRBQ0s6IGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlbmQoZmFsc2UsIG1lc3NhZ2VOYW1lLCBuZWVkQUNLLCBkYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAgKiDlj5HpgIHlhoXpg6jmlbDmja7jgILlj5HpgIHlpLHotKXnm7TmjqXmipvlh7rlvILluLjjgILlhoXpg6jmlbDmja7pu5jorqTkuI3pnIDopoHmjqXmlLbnq6/noa7orqQgICAgICBcclxuICAgICAgKiDms6jmhI/vvJropoHlnKjmr4/kuIDkuKrosIPnlKjnmoTlnLDmlrnlgZrlpb3lvILluLjlpITnkIZcclxuICAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfc2VuZEludGVybmFsKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdIHwgQnVmZmVyID0gW10sIG5lZWRBQ0s6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9zZW5kKHRydWUsIG1lc3NhZ2VOYW1lLCBuZWVkQUNLLCBkYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zZW5kKGlzSW50ZXJuYWw6IGJvb2xlYW4sIG1lc3NhZ2VOYW1lOiBzdHJpbmcsIG5lZWRBQ0s6IGJvb2xlYW4sIGRhdGE6IGFueVtdIHwgQnVmZmVyKTogUHJvbWlzZTx2b2lkPiAmIHsgbWVzc2FnZUlEOiBudW1iZXIgfSB7XHJcbiAgICAgICAgY29uc3QgbXNnSUQgPSB0aGlzLl9tZXNzYWdlSUQrKztcclxuICAgICAgICBjb25zdCBwcm9tOiBhbnkgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuX3NlcmlhbGl6ZUhlYWRlcihpc0ludGVybmFsLCBtZXNzYWdlTmFtZSwgbmVlZEFDSywgbXNnSUQpO1xyXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gQXJyYXkuaXNBcnJheShkYXRhKSA/IEJhc2VTb2NrZXQuc2VyaWFsaXplKGRhdGEpIDogZGF0YTtcclxuICAgICAgICAgICAgY29uc3Qgc2VuZGluZ0RhdGEgPSBfQnVmZmVyLmNvbmNhdChbaGVhZGVyLCBib2R5XSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBjb250cm9sOiBRdWV1ZURhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhOiBzZW5kaW5nRGF0YSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VJRDogbXNnSUQsXHJcbiAgICAgICAgICAgICAgICBjYW5jZWw6IChlcnIpID0+IHsgIC8v6L+Y5pyq5Y+R6YCB5LmL5YmN5omN5Y+v5Lul5Y+W5raIXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlLnZhbHVlcygpLm5leHQoKS52YWx1ZSA9PT0gY29udHJvbCkgIC8v5L2N5LqO6Zif5YiX56ys5LiA5Liq6KGo56S65q2j5Zyo5Y+R6YCBXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUuZGVsZXRlKG1zZ0lEKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBzZW5kOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5lZWRBQ0spIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2VuZERhdGEoc2VuZGluZ0RhdGEpLmNhdGNoKGNvbnRyb2wuYWNrKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZW5kRGF0YShzZW5kaW5nRGF0YSkudGhlbig8YW55PmNvbnRyb2wuYWNrKS5jYXRjaChjb250cm9sLmFjayk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGFjazogKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlLmRlbGV0ZShtc2dJRCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZS5zaXplID4gMCkgICAvL+WmguaenOmYn+WIl+S4rei/mOacie+8jOWImeWPkemAgeS4i+S4gOadoVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZS52YWx1ZXMoKS5uZXh0KCkudmFsdWUuc2VuZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgdGhpcy5fcXVldWUuc2V0KG1zZ0lELCBjb250cm9sKTsgICAgLy/mt7vliqDliLDpmJ/liJfkuK1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZS5zaXplID09PSAxKSB7ICAgLy/lpoLmnpzlj6rmnInliJrliJrorr7nva7nmoTov5nkuIDmnaFcclxuICAgICAgICAgICAgICAgIGNvbnRyb2wuc2VuZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcHJvbS5tZXNzYWdlSUQgPSBtc2dJRDtcclxuICAgICAgICByZXR1cm4gcHJvbTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmcgOimgeWtkOexu+imhuWGmeOAguiwg+eUqF9zb2NrZXTlj5HpgIHmlbDmja5cclxuICAgICAqIFxyXG4gICAgICogQHByb3RlY3RlZFxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSDopoHlj5HpgIHnmoTmlbDmja5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBhYnN0cmFjdCBfc2VuZERhdGEoZGF0YTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOino+aekOaOpeaUtuWIsOaVsOaNruOAguWtkOexu+aOpeaUtuWIsOa2iOaBr+WQjumcgOimgeinpuWPkei/meS4quaWueazlVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEg5o6l5pS25Yiw5pWw5o2uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3JlY2VpdmVEYXRhKGRhdGE6IEJ1ZmZlcikge1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuX2Rlc2VyaWFsaXplSGVhZGVyKGRhdGEpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGhlYWRlcik7XHJcblxyXG4gICAgICAgIGlmIChoZWFkZXIubmVlZEFDSylcclxuICAgICAgICAgICAgdGhpcy5fc2VuZEludGVybmFsKCdhY2snLCBbaGVhZGVyLm1lc3NhZ2VJRF0pLmNhdGNoKGVyciA9PiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKSk7XHJcblxyXG4gICAgICAgIGlmIChoZWFkZXIuaXNJbnRlcm5hbCkgeyAgICAvL+WmguaenOaOpeaUtuWIsOeahOaYr+WGhemDqOWPkeadpeeahOa2iOaBr1xyXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gQmFzZVNvY2tldC5kZXNlcmlhbGl6ZShkYXRhLnNsaWNlKGhlYWRlci5oZWFkZXJMZW5ndGgpKTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoaGVhZGVyLm1lc3NhZ2VOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdhY2snOlxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gdGhpcy5fcXVldWUuZ2V0KGJvZHlbMF0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrLmFjaygpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX25lZWREZXNlcmlhbGl6ZSA/IEJhc2VTb2NrZXQuZGVzZXJpYWxpemUoZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKSkgOiBkYXRhLnNsaWNlKGhlYWRlci5oZWFkZXJMZW5ndGgpO1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBoZWFkZXIubWVzc2FnZU5hbWUsIGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWPlua2iOWPkemAgeOAguWmguaenOafkOadoea2iOaBr+i/mOayoeacieiiq+WPlua2iOWImeWPr+S7peiiq+WPlua2iOOAguWPlua2iOaIkOWKn+i/lOWbnnRydWXvvIzlpLHotKVmYWxzZVxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWVzc2FnZUlEIOimgeWPlua2iOWPkemAgea2iOaBr+eahG1lc3NhZ2VJRFxyXG4gICAgICogQHBhcmFtIHtFcnJvcn0gW2Vycl0g5Lyg6YCS5LiA5LiqZXJyb3LvvIzmjIfnpLrmnKzmrKHlj5HpgIHlsZ7kuo7lpLHotKVcclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSDlj5bmtojmiJDlip/ov5Tlm550cnVl77yM5aSx6LSlZmFsc2VcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIGNhbmNlbChtZXNzYWdlSUQ6IG51bWJlciwgZXJyPzogRXJyb3IpOiBib29sZWFuIHtcclxuICAgICAgICBjb25zdCBjb250cm9sID0gdGhpcy5fcXVldWUuZ2V0KG1lc3NhZ2VJRCk7XHJcblxyXG4gICAgICAgIGlmIChjb250cm9sKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjb250cm9sLmNhbmNlbChlcnIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5YWz6Zet5o6l5Y+j44CC5YWz6Zet5LmL5ZCO5Lya6Kem5Y+RY2xvc2Xkuovku7ZcclxuICAgICAqIFxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBjbG9zZSgpOiB2b2lkO1xyXG5cclxuICAgIG9uKGV2ZW50OiAnZXJyb3InLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+aUtuWIsOa2iOaBr1xyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ21lc3NhZ2UnLCBjYjogKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdIHwgQnVmZmVyKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPov57mjqXlu7rnq4tcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdvcGVuJywgY2I6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOaWreW8gOi/nuaOpVxyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ2Nsb3NlJywgY2I6IChjb2RlOiBudW1iZXIsIHJlYXNvbjogc3RyaW5nKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBvbmNlKGV2ZW50OiAnZXJyb3InLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+aUtuWIsOa2iOaBr1xyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnbWVzc2FnZScsIGNiOiAobWVzc2FnZU5hbWU6IHN0cmluZywgZGF0YTogYW55W10gfCBCdWZmZXIpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+i/nuaOpeW7uueri1xyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnb3BlbicsIGNiOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogJ2Nsb3NlJywgY2I6IChjb2RlOiBudW1iZXIsIHJlYXNvbjogc3RyaW5nKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzIHtcclxuICAgICAgICBzdXBlci5vbmNlKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn0iXX0=
