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
     * @protected
     * @param {Buffer} data 接收到数据
     * @memberof BaseSocket
     */
    _receiveData(data) {
        const header = this._deserializeHeader(data);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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SSxDQUFDLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMvSCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILE1BQU0sQ0FBQyxTQUFpQixFQUFFLEdBQVc7UUFDakMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFM0MsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNWLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUF3QkQsRUFBRSxDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUNoQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFZRCxJQUFJLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztDQUNKO0FBdmRELGdDQXVkQyIsImZpbGUiOiJjb21tb24vQmFzZVNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEVtaXR0ZXIgZnJvbSAnY29tcG9uZW50LWVtaXR0ZXInO1xyXG5pbXBvcnQgKiBhcyBXUyBmcm9tICd3cyc7XHJcbmNvbnN0IF9CdWZmZXI6IHR5cGVvZiBCdWZmZXIgPSBCdWZmZXIgPyBCdWZmZXIgOiByZXF1aXJlKCdidWZmZXIvJykuQnVmZmVyOyAgLy8g56Gu5L+d5rWP6KeI5Zmo5LiL5Lmf6IO95L2/55SoQnVmZmVyXHJcbmNvbnN0IGlzQnVmZmVyID0gcmVxdWlyZSgnaXMtYnVmZmVyJyk7XHJcblxyXG5pbXBvcnQgeyBSZWFkeVN0YXRlIH0gZnJvbSBcIi4vUmVhZHlTdGF0ZVwiO1xyXG5pbXBvcnQgeyBCYXNlU29ja2V0Q29uZmlnIH0gZnJvbSAnLi9CYXNlU29ja2V0Q29uZmlnJztcclxuaW1wb3J0IHsgRGF0YVR5cGUgfSBmcm9tICcuLi9jb21tb24vRGF0YVR5cGUnO1xyXG5pbXBvcnQgeyBRdWV1ZURhdGEgfSBmcm9tICcuL1F1ZXVlRGF0YSc7XHJcblxyXG4vKipcclxuICogU29ja2V0IOaOpeWPo+eahOaKveixoeexu++8jOWumuS5ieS6hnNvY2tldOmcgOimgeWunueOsOeahOWfuuehgOWKn+iDvVxyXG4gKi9cclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VTb2NrZXQgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIF9tZXNzYWdlSUQg55qESUTlj7fvvIxpZOS7jjDlvIDlp4vjgILmr4/lj5HkuIDmnaHmtojmga/vvIzor6VpZOWKoDFcclxuICAgICAqIFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX21lc3NhZ2VJRCA9IDA7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfbmVlZERlc2VyaWFsaXplOiBib29sZWFuO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog562J5b6F5Y+R6YCB5raI5oGv55qE6Zif5YiX44CCa2V577yabWVzc2FnZUlE44CCXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3F1ZXVlOiBNYXA8bnVtYmVyLCBRdWV1ZURhdGE+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y6KKr5YyF6KOF55qEc29ja2V05a+56LGhXHJcbiAgICAgKiBcclxuICAgICAqIEB0eXBlIHsoV2ViU29ja2V0fFdTKX1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IHNvY2tldDogV2ViU29ja2V0IHwgV1M7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXZWJTb2NrZXQgc2VydmVyIOeahFVSTOWcsOWdgCAgIFxyXG4gICAgICog5rOo5oSP77ya5aaC5p6c5pivU2VydmVy55Sf5oiQ55qEU29ja2V077yM5YiZdXJs5Li656m65a2X56ym5LiyXHJcbiAgICAgKiBcclxuICAgICAqIEB0eXBlIHtzdHJpbmd9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSB1cmw6IHN0cmluZztcclxuXHJcbiAgICAvKipcclxuICAgICAqIOW9k+WJjeaOpeWPo+i/kOihjOaJgOWkhOeahOW5s+WPsFxyXG4gICAgICogXHJcbiAgICAgKiBAdHlwZSB7KFwiYnJvd3NlclwiIHwgXCJub2RlXCIpfVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcmVhZG9ubHkgcGxhdGZvcm06IFwiYnJvd3NlclwiIHwgXCJub2RlXCI7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDov57mjqXnmoTlvZPliY3nirbmgIFcclxuICAgICAqIFxyXG4gICAgICogQHJlYWRvbmx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEB0eXBlIHtSZWFkeVN0YXRlfVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgZ2V0IHJlYWR5U3RhdGUoKTogUmVhZHlTdGF0ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc29ja2V0LnJlYWR5U3RhdGU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlnKjnvJPlhrLpmJ/liJfkuK3nrYnlvoXlj5HpgIHnmoTmlbDmja7lrZfoioLmlbBcclxuICAgICAqIFxyXG4gICAgICogQHJlYWRvbmx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBnZXQgYnVmZmVyZWRBbW91bnQoKTogbnVtYmVyIHtcclxuICAgICAgICBsZXQgc2l6ZSA9IDA7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgdGhpcy5fcXVldWUudmFsdWVzKCkpIHtcclxuICAgICAgICAgICAgc2l6ZSArPSBpdGVtLmRhdGEubGVuZ3RoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcGFyYW0geyhXZWJTb2NrZXR8V1MpfSBzb2NrZXQg5a2Q57G75a6e5L6L5YyW55qEc29ja2V05a+56LGhXHJcbiAgICAgKiBAcGFyYW0geyhcImJyb3dzZXJcIiB8IFwibm9kZVwiKX0gcGxhdGZvcm0g5oyH56S66K+l5o6l5Y+j5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VTb2NrZXRDb25maWd9IGNvbmZpZ3Mg6YWN572uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihzb2NrZXQ6IFdlYlNvY2tldCB8IFdTLCBwbGF0Zm9ybTogXCJicm93c2VyXCIgfCBcIm5vZGVcIiwgY29uZmlnczogQmFzZVNvY2tldENvbmZpZykge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMudXJsID0gY29uZmlncy51cmw7XHJcbiAgICAgICAgdGhpcy5fbmVlZERlc2VyaWFsaXplID0gY29uZmlncy5uZWVkRGVzZXJpYWxpemUgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBjb25maWdzLm5lZWREZXNlcmlhbGl6ZTtcclxuICAgICAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcclxuICAgICAgICB0aGlzLnBsYXRmb3JtID0gcGxhdGZvcm07XHJcblxyXG4gICAgICAgIHRoaXMub24oJ2Nsb3NlJywgKCkgPT4geyAgICAvL+WmguaenOaWreW8gO+8jOe7iOatouaJgOaciei/mOacquWPkemAgeeahOa2iOaBr1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuX3F1ZXVlLnZhbHVlcygpKSB7XHJcbiAgICAgICAgICAgICAgICBpdGVtLmNhbmNlbChuZXcgRXJyb3IoJ+i/nuaOpeS4reaWrScpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5a+56KaB5Y+R6YCB55qE5pWw5o2u6L+b6KGM5bqP5YiX5YyW44CC5rOo5oSP5Y+q5pyJ5L2N5LqO5pWw57uE5qC55LiL55qEYm9vbGVhbuOAgXN0cmluZ+OAgW51bWJlcuOAgXZvaWTjgIFCdWZmZXLmiY3kvJrov5vooYzkuozov5vliLbluo/liJfljJbvvIzlr7nosaHkvJrooqtKU09OLnN0cmluZ2lmeSAgICBcclxuICAgICAqIOaVsOaNruagvOW8j++8miDlhYPntKDnsbvlnosgLT4gW+WFg+e0oOmVv+W6pl0gLT4g5YWD57Sg5YaF5a65XHJcbiAgICAgKiBcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXJpYWxpemUoZGF0YTogYW55W10pOiBCdWZmZXIge1xyXG4gICAgICAgIGNvbnN0IGJ1ZmZlckl0ZW1zOiBCdWZmZXJbXSA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGRhdGEpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgaXRlbSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUubnVtYmVyLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlRG91YmxlQkUoaXRlbSwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlckl0ZW1zLnB1c2godHlwZSwgY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLnN0cmluZywgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExlbmd0aC53cml0ZURvdWJsZUJFKGNvbnRlbnQubGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5ib29sZWFuLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlVUludDgoaXRlbSA/IDEgOiAwLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUudW5kZWZpbmVkLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLm51bGwsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzQnVmZmVyKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gaXRlbTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudExlbmd0aCA9IF9CdWZmZXIuYWxsb2MoOCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUuQnVmZmVyLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudExlbmd0aC53cml0ZURvdWJsZUJFKGNvbnRlbnQubGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlckl0ZW1zLnB1c2godHlwZSwgY29udGVudExlbmd0aCwgY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5PYmplY3QsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBfQnVmZmVyLmNvbmNhdChidWZmZXJJdGVtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlr7nmjqXmlLbliLDnmoTmtojmga/ov5vooYzlj43luo/liJfljJZcclxuICAgICAqIFxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEgXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZGVzZXJpYWxpemUoZGF0YTogQnVmZmVyKTogYW55W10ge1xyXG4gICAgICAgIGlmICghaXNCdWZmZXIoZGF0YSkpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign5Lyg5YWl55qE5pWw5o2u57G75Z6L5LiN5pivQnVmZmVyJyk7XHJcblxyXG4gICAgICAgIGxldCBwcmV2aW91cyA9IDA7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICAgIHdoaWxlIChwcmV2aW91cyA8IGRhdGEubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBkYXRhLnJlYWRVSW50OChwcmV2aW91cysrKTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5udW1iZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChkYXRhLnJlYWREb3VibGVCRShwcmV2aW91cykpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLnN0cmluZzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKTtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyArPSA4O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS5zbGljZShwcmV2aW91cywgcHJldmlvdXMgKz0gbGVuZ3RoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChjb250ZW50LnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5ib29sZWFuOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQgPT09IDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS51bmRlZmluZWQ6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5udWxsOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobnVsbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLkJ1ZmZlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKTtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyArPSA4O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChkYXRhLnNsaWNlKHByZXZpb3VzLCBwcmV2aW91cyArPSBsZW5ndGgpKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuT2JqZWN0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnNsaWNlKHByZXZpb3VzLCBwcmV2aW91cyArPSBsZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKEpTT04ucGFyc2UoY29udGVudC50b1N0cmluZygpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdkYXRhIHR5cGUgZG9uYHQgZXhpc3QuIHR5cGU6ICcgKyB0eXBlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOW6j+WIl+WMlua2iOaBr+WktOmDqOOAgiAgICBcclxuICAgICAqIOaVsOaNruagvOW8j++8muWktOmDqOmVv+W6piAtPiDmmK/lkKbmmK/lhoXpg6jmtojmga8gLT4g5raI5oGv5ZCN56ew6ZW/5bqmIC0+IOa2iOaBr+WQjeensCAtPiDor6Xmtojmga/mmK/lkKbpnIDopoHnoa7orqTmlLbliLAgLT4g5raI5oGvaWRcclxuICAgICAqIFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNJbnRlcm5hbCDmmK/lkKbmmK/lhoXpg6jmtojmga9cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlTmFtZSDmtojmga/nmoTlkI3np7BcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbmVlZEFDSyBcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtZXNzYWdlSURcclxuICAgICAqIEByZXR1cm5zIHtCdWZmZXJ9IFxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfc2VyaWFsaXplSGVhZGVyKGlzSW50ZXJuYWw6IGJvb2xlYW4sIG1lc3NhZ2VOYW1lOiBzdHJpbmcsIG5lZWRBQ0s6IGJvb2xlYW4sIG1lc3NhZ2VJRDogbnVtYmVyKTogQnVmZmVyIHtcclxuICAgICAgICBsZXQgX2hlYWRlckxlbmd0aCA9IF9CdWZmZXIuYWxsb2MoOCk7XHJcbiAgICAgICAgbGV0IF9pc0ludGVybmFsID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lID0gX0J1ZmZlci5mcm9tKG1lc3NhZ2VOYW1lKTtcclxuICAgICAgICBsZXQgX25lZWRBQ0sgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZUlEID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgX2lzSW50ZXJuYWwud3JpdGVVSW50OChpc0ludGVybmFsID8gMSA6IDAsIDApO1xyXG4gICAgICAgIF9tZXNzYWdlTmFtZUxlbmd0aC53cml0ZURvdWJsZUJFKF9tZXNzYWdlTmFtZS5sZW5ndGgsIDApO1xyXG4gICAgICAgIF9uZWVkQUNLLndyaXRlVUludDgobmVlZEFDSyA/IDEgOiAwLCAwKTtcclxuICAgICAgICBfbWVzc2FnZUlELndyaXRlRG91YmxlQkUobWVzc2FnZUlELCAwKTtcclxuXHJcbiAgICAgICAgbGV0IGxlbmd0aCA9IF9oZWFkZXJMZW5ndGgubGVuZ3RoICsgX2lzSW50ZXJuYWwubGVuZ3RoICsgX21lc3NhZ2VOYW1lLmxlbmd0aCArIF9tZXNzYWdlTmFtZUxlbmd0aC5sZW5ndGggKyBfbmVlZEFDSy5sZW5ndGggKyBfbWVzc2FnZUlELmxlbmd0aDtcclxuICAgICAgICBfaGVhZGVyTGVuZ3RoLndyaXRlRG91YmxlQkUobGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5jb25jYXQoW19oZWFkZXJMZW5ndGgsIF9pc0ludGVybmFsLCBfbWVzc2FnZU5hbWVMZW5ndGgsIF9tZXNzYWdlTmFtZSwgX25lZWRBQ0ssIF9tZXNzYWdlSURdLCBsZW5ndGgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Y+N5bqP5YiX5YyW5aS06YOoXHJcbiAgICAgKiBAcGFyYW0gZGF0YSDlpLTpg6jkuozov5vliLbmlbDmja5cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfZGVzZXJpYWxpemVIZWFkZXIoZGF0YTogQnVmZmVyKSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgY29uc3QgaGVhZGVyID0ge1xyXG4gICAgICAgICAgICBpc0ludGVybmFsOiB0cnVlLFxyXG4gICAgICAgICAgICBtZXNzYWdlTmFtZTogJycsXHJcbiAgICAgICAgICAgIG5lZWRBQ0s6IGZhbHNlLFxyXG4gICAgICAgICAgICBtZXNzYWdlSUQ6IC0xLFxyXG4gICAgICAgICAgICBoZWFkZXJMZW5ndGg6IDBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBoZWFkZXIuaGVhZGVyTGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUoMCk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gODtcclxuXHJcbiAgICAgICAgaGVhZGVyLmlzSW50ZXJuYWwgPSBkYXRhLnJlYWRVSW50OChpbmRleCsrKSA9PT0gMTtcclxuXHJcbiAgICAgICAgY29uc3QgbWVzc2FnZU5hbWVMZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShpbmRleCk7XHJcbiAgICAgICAgaW5kZXggKz0gODtcclxuXHJcbiAgICAgICAgaGVhZGVyLm1lc3NhZ2VOYW1lID0gZGF0YS5zbGljZShpbmRleCwgaW5kZXggKz0gbWVzc2FnZU5hbWVMZW5ndGgpLnRvU3RyaW5nKCk7XHJcblxyXG4gICAgICAgIGhlYWRlci5uZWVkQUNLID0gZGF0YS5yZWFkVUludDgoaW5kZXgrKykgPT09IDE7XHJcblxyXG4gICAgICAgIGhlYWRlci5tZXNzYWdlSUQgPSBkYXRhLnJlYWREb3VibGVCRShpbmRleCk7XHJcblxyXG4gICAgICAgIHJldHVybiBoZWFkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj5HpgIHmlbDmja7jgILlj5HpgIHlpLHotKXnm7TmjqXmipvlh7rlvILluLhcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VOYW1lIOa2iOaBr+eahOWQjeensCjmoIfpopgpXHJcbiAgICAgKiBAcGFyYW0geyhhbnlbXSB8IEJ1ZmZlcil9IFtkYXRhPVtdXSDopoHlj5HpgIHnmoTmlbDmja7jgILlpoLmnpzmmK/kvKDlhaXnmoTmmK/mlbDnu4TvvIzliJnmlbDmja7lsIbkvb/nlKhCYXNlU29ja2V0LnNlcmlhbGl6ZSgpIOi/m+ihjOW6j+WIl+WMluOAguWmguaenOS8oOWFpeeahOaYr0J1ZmZlcu+8jOWImeWwhuebtOaOpeiiq+WPkemAgeOAglxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbmVlZEFDSz10cnVlXSDlj5Hlh7rnmoTov5nmnaHmtojmga/mmK/lkKbpnIDopoHnoa7orqTlr7nmlrnmmK/lkKblt7Lnu4/mlLbliLBcclxuICAgICAqIEByZXR1cm5zIHsoUHJvbWlzZTx2b2lkPiAmIHsgbWVzc2FnZUlEOiBudW1iZXIgfSl9IG1lc3NhZ2VJRFxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgc2VuZChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlciA9IFtdLCBuZWVkQUNLOiBib29sZWFuID0gdHJ1ZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9zZW5kKGZhbHNlLCBtZXNzYWdlTmFtZSwgbmVlZEFDSywgZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgICog5Y+R6YCB5YaF6YOo5pWw5o2u44CC5Y+R6YCB5aSx6LSl55u05o6l5oqb5Ye65byC5bi444CC5YaF6YOo5pWw5o2u6buY6K6k5LiN6ZyA6KaB5o6l5pS256uv56Gu6K6kICAgICAgXHJcbiAgICAgICog5rOo5oSP77ya6KaB5Zyo5q+P5LiA5Liq6LCD55So55qE5Zyw5pa55YGa5aW95byC5bi45aSE55CGXHJcbiAgICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3NlbmRJbnRlcm5hbChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlciA9IFtdLCBuZWVkQUNLOiBib29sZWFuID0gZmFsc2UpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc2VuZCh0cnVlLCBtZXNzYWdlTmFtZSwgbmVlZEFDSywgZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2VuZChpc0ludGVybmFsOiBib29sZWFuLCBtZXNzYWdlTmFtZTogc3RyaW5nLCBuZWVkQUNLOiBib29sZWFuLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlcik6IFByb21pc2U8dm9pZD4gJiB7IG1lc3NhZ2VJRDogbnVtYmVyIH0ge1xyXG4gICAgICAgIGNvbnN0IG1zZ0lEID0gdGhpcy5fbWVzc2FnZUlEKys7XHJcbiAgICAgICAgY29uc3QgcHJvbTogYW55ID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBoZWFkZXIgPSB0aGlzLl9zZXJpYWxpemVIZWFkZXIoaXNJbnRlcm5hbCwgbWVzc2FnZU5hbWUsIG5lZWRBQ0ssIG1zZ0lEKTtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBCYXNlU29ja2V0LnNlcmlhbGl6ZShkYXRhKSA6IGRhdGE7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbmRpbmdEYXRhID0gX0J1ZmZlci5jb25jYXQoW2hlYWRlciwgYm9keV0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29udHJvbDogUXVldWVEYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgZGF0YTogc2VuZGluZ0RhdGEsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlSUQ6IG1zZ0lELFxyXG4gICAgICAgICAgICAgICAgY2FuY2VsOiAoZXJyKSA9PiB7ICAvL+i/mOacquWPkemAgeS5i+WJjeaJjeWPr+S7peWPlua2iFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZS52YWx1ZXMoKS5uZXh0KCkudmFsdWUgPT09IGNvbnRyb2wpICAvL+S9jeS6jumYn+WIl+esrOS4gOS4quihqOekuuato+WcqOWPkemAgVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlLmRlbGV0ZShtc2dJRCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2VuZDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZWVkQUNLKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NlbmREYXRhKHNlbmRpbmdEYXRhKS5jYXRjaChjb250cm9sLmFjayk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2VuZERhdGEoc2VuZGluZ0RhdGEpLnRoZW4oPGFueT5jb250cm9sLmFjaykuY2F0Y2goY29udHJvbC5hY2spO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhY2s6IChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZS5kZWxldGUobXNnSUQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fcXVldWUuc2l6ZSA+IDApICAgLy/lpoLmnpzpmJ/liJfkuK3ov5jmnInvvIzliJnlj5HpgIHkuIvkuIDmnaFcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUudmFsdWVzKCkubmV4dCgpLnZhbHVlLnNlbmQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlLnNldChtc2dJRCwgY29udHJvbCk7ICAgIC8v5re75Yqg5Yiw6Zif5YiX5LitXHJcblxyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWUuc2l6ZSA9PT0gMSkgeyAgIC8v5aaC5p6c5Y+q5pyJ5Yia5Yia6K6+572u55qE6L+Z5LiA5p2hXHJcbiAgICAgICAgICAgICAgICBjb250cm9sLnNlbmQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHByb20ubWVzc2FnZUlEID0gbXNnSUQ7XHJcbiAgICAgICAgcmV0dXJuIHByb207XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDpnIDopoHlrZDnsbvopoblhpnjgILosIPnlKhfc29ja2V05Y+R6YCB5pWw5o2uXHJcbiAgICAgKiBcclxuICAgICAqIEBwcm90ZWN0ZWRcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEg6KaB5Y+R6YCB55qE5pWw5o2uXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgYWJzdHJhY3QgX3NlbmREYXRhKGRhdGE6IEJ1ZmZlcik6IFByb21pc2U8dm9pZD47XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDop6PmnpDmjqXmlLbliLDmlbDmja7jgILlrZDnsbvmjqXmlLbliLDmtojmga/lkI7pnIDopoHop6blj5Hov5nkuKrmlrnms5VcclxuICAgICAqIFxyXG4gICAgICogQHByb3RlY3RlZFxyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEg5o6l5pS25Yiw5pWw5o2uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3JlY2VpdmVEYXRhKGRhdGE6IEJ1ZmZlcikge1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuX2Rlc2VyaWFsaXplSGVhZGVyKGRhdGEpO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLm5lZWRBQ0spXHJcbiAgICAgICAgICAgIHRoaXMuX3NlbmRJbnRlcm5hbCgnYWNrJywgW2hlYWRlci5tZXNzYWdlSURdKS5jYXRjaChlcnIgPT4gdGhpcy5lbWl0KCdlcnJvcicsIGVycikpO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLmlzSW50ZXJuYWwpIHsgICAgLy/lpoLmnpzmjqXmlLbliLDnmoTmmK/lhoXpg6jlj5HmnaXnmoTmtojmga9cclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IEJhc2VTb2NrZXQuZGVzZXJpYWxpemUoZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKSk7XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGhlYWRlci5tZXNzYWdlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnYWNrJzpcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuX3F1ZXVlLmdldChib2R5WzBdKTtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjay5hY2soKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9uZWVkRGVzZXJpYWxpemUgPyBCYXNlU29ja2V0LmRlc2VyaWFsaXplKGRhdGEuc2xpY2UoaGVhZGVyLmhlYWRlckxlbmd0aCkpIDogZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKTtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgaGVhZGVyLm1lc3NhZ2VOYW1lLCBib2R5KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj5bmtojlj5HpgIHjgILlpoLmnpzmn5DmnaHmtojmga/ov5jmsqHmnInooqvlj5bmtojliJnlj6/ku6Xooqvlj5bmtojjgILlj5bmtojmiJDlip/ov5Tlm550cnVl77yM5aSx6LSlZmFsc2VcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1lc3NhZ2VJRCDopoHlj5bmtojlj5HpgIHmtojmga/nmoRtZXNzYWdlSURcclxuICAgICAqIEBwYXJhbSB7RXJyb3J9IFtlcnJdIOS8oOmAkuS4gOS4qmVycm9y77yM5oyH56S65pys5qyh5Y+R6YCB5bGe5LqO5aSx6LSlXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0g5Y+W5raI5oiQ5Yqf6L+U5ZuedHJ1Ze+8jOWksei0pWZhbHNlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBjYW5jZWwobWVzc2FnZUlEOiBudW1iZXIsIGVycj86IEVycm9yKTogYm9vbGVhbiB7XHJcbiAgICAgICAgY29uc3QgY29udHJvbCA9IHRoaXMuX3F1ZXVlLmdldChtZXNzYWdlSUQpO1xyXG5cclxuICAgICAgICBpZiAoY29udHJvbCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY29udHJvbC5jYW5jZWwoZXJyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWFs+mXreaOpeWPo+OAguWFs+mXreS5i+WQjuS8muinpuWPkWNsb3Nl5LqL5Lu2XHJcbiAgICAgKiBcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHJldHVybnMge3ZvaWR9IFxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgYWJzdHJhY3QgY2xvc2UoKTogdm9pZDtcclxuXHJcbiAgICBvbihldmVudDogJ2Vycm9yJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmlLbliLDmtojmga9cclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdtZXNzYWdlJywgY2I6IChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T6L+e5o6l5bu656uLXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnb3BlbicsIGNiOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDmlq3lvIDov57mjqVcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdjbG9zZScsIGNiOiAoY29kZTogbnVtYmVyLCByZWFzb246IHN0cmluZykgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgb25jZShldmVudDogJ2Vycm9yJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmlLbliLDmtojmga9cclxuICAgICAqL1xyXG4gICAgb25jZShldmVudDogJ21lc3NhZ2UnLCBjYjogKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdIHwgQnVmZmVyKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPov57mjqXlu7rnq4tcclxuICAgICAqL1xyXG4gICAgb25jZShldmVudDogJ29wZW4nLCBjYjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6ICdjbG9zZScsIGNiOiAoY29kZTogbnVtYmVyLCByZWFzb246IHN0cmluZykgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub25jZShldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59Il19
