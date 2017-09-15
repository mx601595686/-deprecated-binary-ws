"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Emitter = require("component-emitter");
const isBuffer = require('is-buffer');
const _Buffer = Buffer ? Buffer : require('buffer/').Buffer; // 确保浏览器下也能使用Buffer
const typedToBuffer = require('typedarray-to-buffer');
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
                    else if (item instanceof ArrayBuffer && !isBuffer(item)) {
                        //针对ArrayBuffer的情况
                        const type = _Buffer.alloc(1);
                        const content = typedToBuffer(item);
                        const contentLength = _Buffer.alloc(8);
                        type.writeUInt8(6 /* Buffer */, 0);
                        contentLength.writeDoubleBE(content.length, 0);
                        bufferItems.push(type, contentLength, content);
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
     * @param {(any[] | Buffer)} [data] 要发送的数据。如果是传入的是数组，则数据将使用BaseSocket.serialize() 进行序列化。如果传入的是Buffer，则将直接被发送。如果只发送messageName，也可以留空。
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @returns {Promise<number>} messageID
     * @memberof BaseSocket
     */
    send(messageName, data, needACK = true) {
        return this._send(false, messageName, needACK, data);
    }
    /**
      * 发送内部数据。发送失败直接抛出异常。
      * 注意：要在每一个调用的地方做好异常处理
      */
    async _sendInternal(messageName, data, needACK = false) {
        return this._send(true, messageName, needACK, data);
    }
    _send(isInternal, messageName, needACK, data = []) {
        return new Promise((resolve, reject) => {
            const msgID = this._messageID++;
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
            if (this._queue.size === 0) {
                control.send();
            }
            else {
                this._queue.set(msgID, control);
            }
        });
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUN6QixLQUFLLEtBQUs7b0JBQ04sTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFDLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQzNCLEtBQUssQ0FBQztZQUNkLENBQUM7UUFDTCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQy9ILElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUF3QkQsRUFBRSxDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUNoQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFZRCxJQUFJLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztDQUNKO0FBdmNELGdDQXVjQyIsImZpbGUiOiJjb21tb24vQmFzZVNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEVtaXR0ZXIgZnJvbSAnY29tcG9uZW50LWVtaXR0ZXInO1xyXG5pbXBvcnQgKiBhcyBXUyBmcm9tICd3cyc7XHJcbmNvbnN0IGlzQnVmZmVyID0gcmVxdWlyZSgnaXMtYnVmZmVyJyk7XHJcbmNvbnN0IF9CdWZmZXI6IHR5cGVvZiBCdWZmZXIgPSBCdWZmZXIgPyBCdWZmZXIgOiByZXF1aXJlKCdidWZmZXIvJykuQnVmZmVyOyAgLy8g56Gu5L+d5rWP6KeI5Zmo5LiL5Lmf6IO95L2/55SoQnVmZmVyXHJcbmNvbnN0IHR5cGVkVG9CdWZmZXIgPSByZXF1aXJlKCd0eXBlZGFycmF5LXRvLWJ1ZmZlcicpO1xyXG5cclxuaW1wb3J0IHsgUmVhZHlTdGF0ZSB9IGZyb20gXCIuL1JlYWR5U3RhdGVcIjtcclxuaW1wb3J0IHsgQmFzZVNvY2tldENvbmZpZyB9IGZyb20gJy4vQmFzZVNvY2tldENvbmZpZyc7XHJcbmltcG9ydCB7IERhdGFUeXBlIH0gZnJvbSAnLi4vY29tbW9uL0RhdGFUeXBlJztcclxuaW1wb3J0IHsgUXVldWVEYXRhIH0gZnJvbSAnLi9RdWV1ZURhdGEnO1xyXG5cclxuLyoqXHJcbiAqIFNvY2tldCDmjqXlj6PnmoTmir3osaHnsbvvvIzlrprkuYnkuoZzb2NrZXTpnIDopoHlrp7njrDnmoTln7rnoYDlip/og71cclxuICovXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlU29ja2V0IGV4dGVuZHMgRW1pdHRlciB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBfbWVzc2FnZUlEIOeahElE5Y+377yMaWTku44w5byA5aeL44CC5q+P5Y+R5LiA5p2h5raI5oGv77yM6K+laWTliqAxXHJcbiAgICAgKiBcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9tZXNzYWdlSUQgPSAwO1xyXG5cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX25lZWREZXNlcmlhbGl6ZTogYm9vbGVhbjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOetieW+heWPkemAgea2iOaBr+eahOmYn+WIl+OAgmtlee+8mm1lc3NhZ2VJROOAglxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9xdWV1ZTogTWFwPG51bWJlciwgUXVldWVEYXRhPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOS/neWtmOiiq+WMheijheeahHNvY2tldOWvueixoVxyXG4gICAgICogXHJcbiAgICAgKiBAdHlwZSB7KFdlYlNvY2tldHxXUyl9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBzb2NrZXQ6IFdlYlNvY2tldCB8IFdTO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2ViU29ja2V0IHNlcnZlciDnmoRVUkzlnLDlnYAgICBcclxuICAgICAqIOazqOaEj++8muWmguaenOaYr1NlcnZlcueUn+aIkOeahFNvY2tldO+8jOWImXVybOS4uuepuuWtl+espuS4slxyXG4gICAgICogXHJcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcmVhZG9ubHkgdXJsOiBzdHJpbmc7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPliY3mjqXlj6Pov5DooYzmiYDlpITnmoTlubPlj7BcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUgeyhcImJyb3dzZXJcIiB8IFwibm9kZVwiKX1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IHBsYXRmb3JtOiBcImJyb3dzZXJcIiB8IFwibm9kZVwiO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog6L+e5o6l55qE5b2T5YmN54q25oCBXHJcbiAgICAgKiBcclxuICAgICAqIEByZWFkb25seVxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAdHlwZSB7UmVhZHlTdGF0ZX1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIGdldCByZWFkeVN0YXRlKCk6IFJlYWR5U3RhdGUge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNvY2tldC5yZWFkeVN0YXRlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Zyo57yT5Yay6Zif5YiX5Lit562J5b6F5Y+R6YCB55qE5pWw5o2u5a2X6IqC5pWwXHJcbiAgICAgKiBcclxuICAgICAqIEByZWFkb25seVxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgZ2V0IGJ1ZmZlcmVkQW1vdW50KCk6IG51bWJlciB7XHJcbiAgICAgICAgbGV0IHNpemUgPSAwO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuX3F1ZXVlLnZhbHVlcygpKSB7XHJcbiAgICAgICAgICAgIHNpemUgKz0gaXRlbS5kYXRhLmxlbmd0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBzaXplO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHsoV2ViU29ja2V0fFdTKX0gc29ja2V0IOWtkOexu+WunuS+i+WMlueahHNvY2tldOWvueixoVxyXG4gICAgICogQHBhcmFtIHsoXCJicm93c2VyXCIgfCBcIm5vZGVcIil9IHBsYXRmb3JtIOaMh+ekuuivpeaOpeWPo+aJgOWkhOeahOW5s+WPsFxyXG4gICAgICogQHBhcmFtIHtCYXNlU29ja2V0Q29uZmlnfSBjb25maWdzIOmFjee9rlxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3Ioc29ja2V0OiBXZWJTb2NrZXQgfCBXUywgcGxhdGZvcm06IFwiYnJvd3NlclwiIHwgXCJub2RlXCIsIGNvbmZpZ3M6IEJhc2VTb2NrZXRDb25maWcpIHtcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICB0aGlzLnVybCA9IGNvbmZpZ3MudXJsO1xyXG4gICAgICAgIHRoaXMuX25lZWREZXNlcmlhbGl6ZSA9IGNvbmZpZ3MubmVlZERlc2VyaWFsaXplID09PSB1bmRlZmluZWQgPyB0cnVlIDogY29uZmlncy5uZWVkRGVzZXJpYWxpemU7XHJcbiAgICAgICAgdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XHJcbiAgICAgICAgdGhpcy5wbGF0Zm9ybSA9IHBsYXRmb3JtO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5a+56KaB5Y+R6YCB55qE5pWw5o2u6L+b6KGM5bqP5YiX5YyW44CC5rOo5oSP5Y+q5pyJ5L2N5LqO5pWw57uE5qC55LiL55qEYm9vbGVhbuOAgXN0cmluZ+OAgW51bWJlcuOAgXZvaWTjgIFCdWZmZXLmiY3kvJrov5vooYzkuozov5vliLbluo/liJfljJbvvIzlr7nosaHkvJrooqtKU09OLnN0cmluZ2lmeSAgICBcclxuICAgICAqIOaVsOaNruagvOW8j++8miDlhYPntKDnsbvlnosgLT4gW+WFg+e0oOmVv+W6pl0gLT4g5YWD57Sg5YaF5a65XHJcbiAgICAgKiBcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXJpYWxpemUoZGF0YTogYW55W10pOiBCdWZmZXIge1xyXG4gICAgICAgIGNvbnN0IGJ1ZmZlckl0ZW1zOiBCdWZmZXJbXSA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGRhdGEpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgaXRlbSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUubnVtYmVyLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlRG91YmxlQkUoaXRlbSwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlckl0ZW1zLnB1c2godHlwZSwgY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLnN0cmluZywgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExlbmd0aC53cml0ZURvdWJsZUJFKGNvbnRlbnQubGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5ib29sZWFuLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlVUludDgoaXRlbSA/IDEgOiAwLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUudW5kZWZpbmVkLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLm51bGwsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciAmJiAhaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy/pkojlr7lBcnJheUJ1ZmZlcueahOaDheWGtVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHR5cGVkVG9CdWZmZXIoaXRlbSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLkJ1ZmZlciwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBpdGVtO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5CdWZmZXIsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLk9iamVjdCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9CdWZmZXIuY29uY2F0KGJ1ZmZlckl0ZW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWvueaOpeaUtuWIsOeahOa2iOaBr+i/m+ihjOWPjeW6j+WIl+WMllxyXG4gICAgICogXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBkZXNlcmlhbGl6ZShkYXRhOiBCdWZmZXIpOiBhbnlbXSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgbGV0IHByZXZpb3VzID0gMDtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHByZXZpb3VzIDwgZGF0YS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bWJlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuc3RyaW5nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnNsaWNlKHByZXZpb3VzLCBwcmV2aW91cyArPSBsZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLmJvb2xlYW46IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS5yZWFkVUludDgocHJldmlvdXMrKyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goY29udGVudCA9PT0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLnVuZGVmaW5lZDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bGw6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuQnVmZmVyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5PYmplY3Q6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShwcmV2aW91cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goSlNPTi5wYXJzZShjb250ZW50LnRvU3RyaW5nKCkpKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RhdGEgdHlwZSBkb25gdCBleGlzdC4gdHlwZTogJyArIHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqP5YiX5YyW5raI5oGv5aS06YOo44CCICAgIFxyXG4gICAgICog5pWw5o2u5qC85byP77ya5aS06YOo6ZW/5bqmIC0+IOaYr+WQpuaYr+WGhemDqOa2iOaBryAtPiDmtojmga/lkI3np7Dplb/luqYgLT4g5raI5oGv5ZCN56ewIC0+IOivpea2iOaBr+aYr+WQpumcgOimgeehruiupOaUtuWIsCAtPiDmtojmga9pZFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc0ludGVybmFsIOaYr+WQpuaYr+WGhemDqOa2iOaBr1xyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VOYW1lIOa2iOaBr+eahOWQjeensFxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBuZWVkQUNLIFxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1lc3NhZ2VJRFxyXG4gICAgICogQHJldHVybnMge0J1ZmZlcn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9zZXJpYWxpemVIZWFkZXIoaXNJbnRlcm5hbDogYm9vbGVhbiwgbWVzc2FnZU5hbWU6IHN0cmluZywgbmVlZEFDSzogYm9vbGVhbiwgbWVzc2FnZUlEOiBudW1iZXIpOiBCdWZmZXIge1xyXG4gICAgICAgIGxldCBfaGVhZGVyTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX2lzSW50ZXJuYWwgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZU5hbWVMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZU5hbWUgPSBfQnVmZmVyLmZyb20obWVzc2FnZU5hbWUpO1xyXG4gICAgICAgIGxldCBfbmVlZEFDSyA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgbGV0IF9tZXNzYWdlSUQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICBfaXNJbnRlcm5hbC53cml0ZVVJbnQ4KGlzSW50ZXJuYWwgPyAxIDogMCwgMCk7XHJcbiAgICAgICAgX21lc3NhZ2VOYW1lTGVuZ3RoLndyaXRlRG91YmxlQkUoX21lc3NhZ2VOYW1lLmxlbmd0aCwgMCk7XHJcbiAgICAgICAgX25lZWRBQ0sud3JpdGVVSW50OChuZWVkQUNLID8gMSA6IDAsIDApO1xyXG4gICAgICAgIF9tZXNzYWdlSUQud3JpdGVEb3VibGVCRShtZXNzYWdlSUQsIDApO1xyXG5cclxuICAgICAgICBsZXQgbGVuZ3RoID0gX2hlYWRlckxlbmd0aC5sZW5ndGggKyBfaXNJbnRlcm5hbC5sZW5ndGggKyBfbWVzc2FnZU5hbWUubGVuZ3RoICsgX21lc3NhZ2VOYW1lTGVuZ3RoLmxlbmd0aCArIF9uZWVkQUNLLmxlbmd0aCArIF9tZXNzYWdlSUQubGVuZ3RoO1xyXG4gICAgICAgIF9oZWFkZXJMZW5ndGgud3JpdGVEb3VibGVCRShsZW5ndGgsIDApO1xyXG5cclxuICAgICAgICByZXR1cm4gQnVmZmVyLmNvbmNhdChbX2hlYWRlckxlbmd0aCwgX2lzSW50ZXJuYWwsIF9tZXNzYWdlTmFtZUxlbmd0aCwgX21lc3NhZ2VOYW1lLCBfbmVlZEFDSywgX21lc3NhZ2VJRF0sIGxlbmd0aCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj43luo/liJfljJblpLTpg6hcclxuICAgICAqIEBwYXJhbSBkYXRhIOWktOmDqOS6jOi/m+WItuaVsOaNrlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9kZXNlcmlhbGl6ZUhlYWRlcihkYXRhOiBCdWZmZXIpIHtcclxuICAgICAgICBpZiAoIWlzQnVmZmVyKGRhdGEpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+S8oOWFpeeahOaVsOaNruexu+Wei+S4jeaYr0J1ZmZlcicpO1xyXG5cclxuICAgICAgICBjb25zdCBoZWFkZXIgPSB7XHJcbiAgICAgICAgICAgIGlzSW50ZXJuYWw6IHRydWUsXHJcbiAgICAgICAgICAgIG1lc3NhZ2VOYW1lOiAnJyxcclxuICAgICAgICAgICAgbmVlZEFDSzogZmFsc2UsXHJcbiAgICAgICAgICAgIG1lc3NhZ2VJRDogLTEsXHJcbiAgICAgICAgICAgIGhlYWRlckxlbmd0aDogMFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGhlYWRlci5oZWFkZXJMZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRSgwKTtcclxuICAgICAgICBsZXQgaW5kZXggPSA4O1xyXG5cclxuICAgICAgICBoZWFkZXIuaXNJbnRlcm5hbCA9IGRhdGEucmVhZFVJbnQ4KGluZGV4KyspID09PSAxO1xyXG5cclxuICAgICAgICBjb25zdCBtZXNzYWdlTmFtZUxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKGluZGV4KTtcclxuICAgICAgICBpbmRleCArPSA4O1xyXG5cclxuICAgICAgICBoZWFkZXIubWVzc2FnZU5hbWUgPSBkYXRhLnNsaWNlKGluZGV4LCBpbmRleCArPSBtZXNzYWdlTmFtZUxlbmd0aCkudG9TdHJpbmcoKTtcclxuXHJcbiAgICAgICAgaGVhZGVyLm5lZWRBQ0sgPSBkYXRhLnJlYWRVSW50OChpbmRleCsrKSA9PT0gMTtcclxuXHJcbiAgICAgICAgaGVhZGVyLm1lc3NhZ2VJRCA9IGRhdGEucmVhZERvdWJsZUJFKGluZGV4KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGhlYWRlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWPkemAgeaVsOaNruOAguWPkemAgeWksei0peebtOaOpeaKm+WHuuW8guW4uFxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZU5hbWUg5raI5oGv55qE5ZCN56ewKOagh+mimClcclxuICAgICAqIEBwYXJhbSB7KGFueVtdIHwgQnVmZmVyKX0gW2RhdGFdIOimgeWPkemAgeeahOaVsOaNruOAguWmguaenOaYr+S8oOWFpeeahOaYr+aVsOe7hO+8jOWImeaVsOaNruWwhuS9v+eUqEJhc2VTb2NrZXQuc2VyaWFsaXplKCkg6L+b6KGM5bqP5YiX5YyW44CC5aaC5p6c5Lyg5YWl55qE5pivQnVmZmVy77yM5YiZ5bCG55u05o6l6KKr5Y+R6YCB44CC5aaC5p6c5Y+q5Y+R6YCBbWVzc2FnZU5hbWXvvIzkuZ/lj6/ku6XnlZnnqbrjgIJcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW25lZWRBQ0s9dHJ1ZV0g5Y+R5Ye655qE6L+Z5p2h5raI5oGv5piv5ZCm6ZyA6KaB56Gu6K6k5a+55pa55piv5ZCm5bey57uP5pS25YiwXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fSBtZXNzYWdlSURcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHNlbmQobWVzc2FnZU5hbWU6IHN0cmluZywgZGF0YT86IGFueVtdIHwgQnVmZmVyLCBuZWVkQUNLOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8bnVtYmVyPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlbmQoZmFsc2UsIG1lc3NhZ2VOYW1lLCBuZWVkQUNLLCBkYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAgKiDlj5HpgIHlhoXpg6jmlbDmja7jgILlj5HpgIHlpLHotKXnm7TmjqXmipvlh7rlvILluLjjgIIgICAgICBcclxuICAgICAgKiDms6jmhI/vvJropoHlnKjmr4/kuIDkuKrosIPnlKjnmoTlnLDmlrnlgZrlpb3lvILluLjlpITnkIZcclxuICAgICAgKi9cclxuICAgIHByb3RlY3RlZCBhc3luYyBfc2VuZEludGVybmFsKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE/OiBhbnlbXSB8IEJ1ZmZlciwgbmVlZEFDSzogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxudW1iZXI+IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc2VuZCh0cnVlLCBtZXNzYWdlTmFtZSwgbmVlZEFDSywgZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2VuZChpc0ludGVybmFsOiBib29sZWFuLCBtZXNzYWdlTmFtZTogc3RyaW5nLCBuZWVkQUNLOiBib29sZWFuLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlciA9IFtdKTogUHJvbWlzZTxudW1iZXI+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBtc2dJRCA9IHRoaXMuX21lc3NhZ2VJRCsrO1xyXG4gICAgICAgICAgICBjb25zdCBoZWFkZXIgPSB0aGlzLl9zZXJpYWxpemVIZWFkZXIoaXNJbnRlcm5hbCwgbWVzc2FnZU5hbWUsIG5lZWRBQ0ssIG1zZ0lEKTtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBCYXNlU29ja2V0LnNlcmlhbGl6ZShkYXRhKSA6IGRhdGE7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbmRpbmdEYXRhID0gX0J1ZmZlci5jb25jYXQoW2hlYWRlciwgYm9keV0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29udHJvbDogUXVldWVEYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgZGF0YTogc2VuZGluZ0RhdGEsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlSUQ6IG1zZ0lELFxyXG4gICAgICAgICAgICAgICAgY2FuY2VsOiAoZXJyKSA9PiB7ICAvL+i/mOacquWPkemAgeS5i+WJjeaJjeWPr+S7peWPlua2iFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZS52YWx1ZXMoKS5uZXh0KCkudmFsdWUgPT09IGNvbnRyb2wpICAvL+S9jeS6jumYn+WIl+esrOS4gOS4quihqOekuuato+WcqOWPkemAgVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlLmRlbGV0ZShtc2dJRCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgc2VuZDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChuZWVkQUNLKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NlbmREYXRhKHNlbmRpbmdEYXRhKS5jYXRjaChjb250cm9sLmFjayk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2VuZERhdGEoc2VuZGluZ0RhdGEpLnRoZW4oPGFueT5jb250cm9sLmFjaykuY2F0Y2goY29udHJvbC5hY2spO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBhY2s6IChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZS5kZWxldGUobXNnSUQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fcXVldWUuc2l6ZSA+IDApICAgLy/lpoLmnpzpmJ/liJfkuK3ov5jmnInvvIzliJnlj5HpgIHkuIvkuIDmnaFcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUudmFsdWVzKCkubmV4dCgpLnZhbHVlLnNlbmQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZS5zaXplID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sLnNlbmQoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlLnNldChtc2dJRCwgY29udHJvbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmcgOimgeWtkOexu+imhuWGmeOAguiwg+eUqF9zb2NrZXTlj5HpgIHmlbDmja5cclxuICAgICAqIFxyXG4gICAgICogQHByb3RlY3RlZFxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSDopoHlj5HpgIHnmoTmlbDmja5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBhYnN0cmFjdCBfc2VuZERhdGEoZGF0YTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOino+aekOaOpeaUtuWIsOaVsOaNruOAguWtkOexu+aOpeaUtuWIsOa2iOaBr+WQjumcgOimgeinpuWPkei/meS4quaWueazlVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEg5o6l5pS25Yiw5pWw5o2uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3JlY2VpdmVEYXRhKGRhdGE6IEJ1ZmZlcikge1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuX2Rlc2VyaWFsaXplSGVhZGVyKGRhdGEpO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLm5lZWRBQ0spXHJcbiAgICAgICAgICAgIHRoaXMuX3NlbmRJbnRlcm5hbCgnYWNrJywgW2hlYWRlci5tZXNzYWdlSURdKS5jYXRjaChlcnIgPT4gdGhpcy5lbWl0KCdlcnJvcicsIGVycikpO1xyXG5cclxuICAgICAgICBpZiAoaGVhZGVyLmlzSW50ZXJuYWwpIHsgICAgLy/lpoLmnpzmjqXmlLbliLDnmoTmmK/lhoXpg6jlj5HmnaXnmoTmtojmga9cclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IEJhc2VTb2NrZXQuZGVzZXJpYWxpemUoZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKSk7XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGhlYWRlci5tZXNzYWdlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnYWNrJzpcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuX3F1ZXVlLmdldChib2R5WzBdKTtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjay5hY2soKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9uZWVkRGVzZXJpYWxpemUgPyBCYXNlU29ja2V0LmRlc2VyaWFsaXplKGRhdGEuc2xpY2UoaGVhZGVyLmhlYWRlckxlbmd0aCkpIDogZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKTtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgaGVhZGVyLm1lc3NhZ2VOYW1lLCBib2R5KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlhbPpl63mjqXlj6PjgILlhbPpl63kuYvlkI7kvJrop6blj5FjbG9zZeS6i+S7tlxyXG4gICAgICogXHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIGFic3RyYWN0IGNsb3NlKCk6IHZvaWQ7XHJcblxyXG4gICAgb24oZXZlbnQ6ICdlcnJvcicsIGNiOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T5pS25Yiw5raI5oGvXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnbWVzc2FnZScsIGNiOiAobWVzc2FnZU5hbWU6IHN0cmluZywgZGF0YTogYW55W10gfCBCdWZmZXIpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+i/nuaOpeW7uueri1xyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ29wZW4nLCBjYjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5pat5byA6L+e5o6lXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnY2xvc2UnLCBjYjogKGNvZGU6IG51bWJlciwgcmVhc29uOiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzIHtcclxuICAgICAgICBzdXBlci5vbihldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIG9uY2UoZXZlbnQ6ICdlcnJvcicsIGNiOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T5pS25Yiw5raI5oGvXHJcbiAgICAgKi9cclxuICAgIG9uY2UoZXZlbnQ6ICdtZXNzYWdlJywgY2I6IChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhOiBhbnlbXSB8IEJ1ZmZlcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T6L+e5o6l5bu656uLXHJcbiAgICAgKi9cclxuICAgIG9uY2UoZXZlbnQ6ICdvcGVuJywgY2I6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiAnY2xvc2UnLCBjYjogKGNvZGU6IG51bWJlciwgcmVhc29uOiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uY2UoZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufSJdfQ==
