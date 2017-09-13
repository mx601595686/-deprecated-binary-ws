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
     * @param {*} socket 子类实例化的socket对象
     * @param {("browser" | "node")} platform 指示该接口所处的平台
     * @param {BaseSocketConfig} configs 配置
     * @memberof BaseSocket
     */
    constructor(socket, platform, configs) {
        super();
        /**
         * _messageID 的ID号，id从0开始。每发一条needACK的消息，该id加1
         *
         * @private
         * @memberof BaseSocket
         */
        this._messageID = 0;
        /**
         * 接收到的messageID编号
         *
         * @private
         * @memberof BaseSocket
         */
        this._receivedMessageID = -1;
        /**
         * 保存接收接收端发回的确认消息的回调函数
         * key:_messageID
         *
         * @private
         * @memberof BaseSocket
         */
        this._message = new Map();
        /**
         * 发送ping来检查连接是否正常的间隔时间。
         * 连续失败3次就会断开连接
         *
         * @private
         * @type {number}
         * @memberof BaseSocket
         */
        this._pingInterval = 1000 * 20;
        /**
         * 收到客户端发来ping时的时间戳
         */
        this._receivedPing = 0;
        const { url, sendingRetry = 3, sendingTimeout = 1000 * 60, needDeserialize = true } = configs;
        this.url = url;
        this._sendingRetry = sendingRetry;
        this._sendingTimeout = sendingTimeout;
        this._needDeserialize = needDeserialize;
        this.socket = socket;
        this.platform = platform;
        this.monitorPing();
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
                    const content = data.slice(previous, length);
                    result.push(content.toString());
                    previous += length;
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
                    result.push(data.slice(previous, length));
                    previous += length;
                    break;
                }
                case 5 /* Object */: {
                    const length = data.readDoubleBE(previous);
                    previous += 8;
                    const content = data.slice(previous, length);
                    result.push(JSON.parse(content.toString()));
                    previous += length;
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
     * 数据格式：头部长度 -> 消息名称长度 -> 消息名称 -> 该消息是否需要确认收到 -> [消息id]
     *
     * @private
     * @param {string} messageName 消息的名称
     * @param {boolean} needACK
     * @param {number} [messageID]
     * @returns {Buffer}
     * @memberof BaseSocket
     */
    serializeHeader(messageName, needACK, messageID) {
        let _headerLength = _Buffer.alloc(8);
        let _messageNameLength = _Buffer.alloc(8);
        let _messageName = _Buffer.from(messageName);
        let _needACK = _Buffer.alloc(1);
        let _messageID = needACK ? _Buffer.alloc(8) : _Buffer.alloc(0);
        _messageNameLength.writeDoubleBE(_messageName.length, 0);
        _needACK.writeUInt8(needACK ? 1 : 0, 0);
        needACK && _messageID.writeDoubleBE(messageID, 0);
        let length = _headerLength.length + _messageName.length + _messageNameLength.length + _needACK.length + _messageID.length;
        _headerLength.writeDoubleBE(length, 0);
        return Buffer.concat([_headerLength, _messageNameLength, _messageName, _needACK, _messageID], length);
    }
    /**
     * 反序列化头部
     * @param data 头部二进制数据
     */
    deserializeHeader(data) {
        if (!isBuffer(data))
            throw new Error('传入的数据类型不是Buffer');
        const header = {
            messageName: '',
            needACK: false,
            messageID: -1,
            headerLength: 0
        };
        header.headerLength = data.readDoubleBE(0);
        let index = 8;
        const messageNameLength = data.readDoubleBE(index);
        index += 8;
        header.messageName = data.slice(index, index + messageNameLength).toString();
        index += messageNameLength;
        header.needACK = data.readUInt8(index++) === 1;
        header.messageID = data.readDoubleBE(index);
        return header;
    }
    /**
     * 启动ping检查连接是否正常
     *
     * @private
     * @memberof BaseSocket
     */
    monitorPing() {
        let timer;
        let lastTime = 0; //上一次收到ping的时间
        let failuresNumber = 0; //连续失败的次数。最多连续3次就断开连接
        this.on('open', () => {
            timer = setInterval(() => {
                if (this._receivedPing > lastTime) {
                    lastTime = this._receivedPing;
                    failuresNumber = 0;
                }
                else if (failuresNumber++ > 3) {
                    this.emit('error', new Error('ping接收端，一分钟内无应答'));
                    clearInterval(timer);
                    this.close();
                }
                this._sendInternal('ping');
            }, this._pingInterval);
        });
        this.on('close', () => {
            clearInterval(timer);
        });
    }
    /**
     * 发送数据。发送失败直接抛出异常
     *
     * @param {string} messageName 消息的名称(标题)
     * @param {any[]} [data] 要发送的数据。如果只发送messageName，数据可以留空
     * @param {boolean} [needACK=true] 发出的这条消息是否需要确认对方是否已经收到
     * @returns {Promise<void>}
     * @memberof BaseSocket
     */
    send(messageName, data, needACK = true) {
        return new Promise((resolve, reject) => {
            const body = data ? BaseSocket.serialize(data) : _Buffer.alloc(0);
            if (needACK) {
                const messageID = this._messageID++;
                const header = this.serializeHeader(messageName, needACK, messageID);
                const data = _Buffer.concat([header, body]);
                this._message.set(messageID, () => {
                    this._message.delete(messageID);
                    resolve();
                });
                (async () => {
                    try {
                        for (var index = 0; index < this._sendingRetry; index++) {
                            if (!this._message.has(messageID))
                                return; //判断对方是否已经收到了
                            await this._sendData(data);
                            await new Promise(res => setTimeout(res, this._sendingTimeout));
                        }
                        throw new Error(`发送数据失败。在尝试${this._sendingRetry}次重发之后，接收端依然没有回应收到。`);
                    }
                    finally {
                        this._message.delete(messageID);
                    }
                })().then(resolve).catch(reject);
            }
            else {
                const header = this.serializeHeader(messageName, needACK);
                this._sendData(_Buffer.concat([header, body])).then(resolve).catch(reject);
            }
        });
    }
    /**
     * 发送内部数据。
     * 注意：所有发送的内部消息都是不需要对方验证是否收到的。如果发送时出现错误会自动触发error事件
     *
     * @protected
     * @param {string} messageName 消息名称
     * @param {...any[]} data 其余数据
     * @memberof BaseSocket
     */
    _sendInternal(messageName, ...data) {
        return this.send('__bws_internal__', [messageName, ...data], false).catch(err => this.emit('error', err));
    }
    /**
     * 解析接收到数据。子类接收到消息后需要触发这个方法
     *
     * @private
     * @param {*} data 接收到数据
     * @memberof BaseSocket
     */
    _receiveData(data) {
        const header = this.deserializeHeader(data);
        if (header.messageName === '__bws_internal__') {
            const body = BaseSocket.deserialize(data.slice(header.headerLength));
            switch (body[0]) {
                case 'ack':
                    const callback = this._message.get(body[1]);
                    callback && callback();
                    break;
                case 'ping':
                    this._receivedPing = (new Date).getTime();
                    break;
            }
        }
        else {
            const body = this._needDeserialize ? BaseSocket.deserialize(data.slice(header.headerLength)) : data.slice(header.headerLength);
            if (header.needACK) {
                if (this._receivedMessageID < header.messageID) {
                    this._receivedMessageID = header.messageID;
                    this.emit('message', header.messageName, body);
                }
                this._sendInternal('ack', header.messageID);
            }
            else {
                this.emit('message', header.messageName, body);
            }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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YSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDaEQsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBcUJELEVBQUUsQ0FBQyxLQUFhLEVBQUUsUUFBa0I7UUFDaEMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0lBWUQsSUFBSSxDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUNsQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7Q0FDSjtBQWpnQkQsZ0NBaWdCQyIsImZpbGUiOiJjb21tb24vQmFzZVNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEVtaXR0ZXIgZnJvbSAnY29tcG9uZW50LWVtaXR0ZXInO1xyXG5jb25zdCBpc0J1ZmZlciA9IHJlcXVpcmUoJ2lzLWJ1ZmZlcicpO1xyXG5jb25zdCBfQnVmZmVyOiB0eXBlb2YgQnVmZmVyID0gQnVmZmVyID8gQnVmZmVyIDogcmVxdWlyZSgnYnVmZmVyLycpLkJ1ZmZlcjsgIC8vIOehruS/nea1j+iniOWZqOS4i+S5n+iDveS9v+eUqEJ1ZmZlclxyXG5jb25zdCB0eXBlZFRvQnVmZmVyID0gcmVxdWlyZSgndHlwZWRhcnJheS10by1idWZmZXInKTtcclxuXHJcbmltcG9ydCB7IFJlYWR5U3RhdGUgfSBmcm9tIFwiLi9SZWFkeVN0YXRlXCI7XHJcbmltcG9ydCB7IEJhc2VTb2NrZXRDb25maWcgfSBmcm9tICcuL0Jhc2VTb2NrZXRDb25maWcnO1xyXG5pbXBvcnQgeyBEYXRhVHlwZSB9IGZyb20gJy4uL2NvbW1vbi9EYXRhVHlwZSc7XHJcblxyXG4vKipcclxuICogU29ja2V0IOaOpeWPo+eahOaKveixoeexu++8jOWumuS5ieS6hnNvY2tldOmcgOimgeWunueOsOeahOWfuuehgOWKn+iDvVxyXG4gKi9cclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VTb2NrZXQgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIF9tZXNzYWdlSUQg55qESUTlj7fvvIxpZOS7jjDlvIDlp4vjgILmr4/lj5HkuIDmnaFuZWVkQUNL55qE5raI5oGv77yM6K+laWTliqAxXHJcbiAgICAgKiBcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9tZXNzYWdlSUQgPSAwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5o6l5pS25Yiw55qEbWVzc2FnZUlE57yW5Y+3XHJcbiAgICAgKiBcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWNlaXZlZE1lc3NhZ2VJRCA9IC0xO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y5o6l5pS25o6l5pS256uv5Y+R5Zue55qE56Gu6K6k5raI5oGv55qE5Zue6LCD5Ye95pWwXHJcbiAgICAgKiBrZXk6X21lc3NhZ2VJRFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZTogTWFwPG51bWJlciwgRnVuY3Rpb24+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3NlbmRpbmdUaW1lb3V0OiBudW1iZXI7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfc2VuZGluZ1JldHJ5OiBudW1iZXI7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfbmVlZERlc2VyaWFsaXplOiBib29sZWFuO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Y+R6YCBcGluZ+adpeajgOafpei/nuaOpeaYr+WQpuato+W4uOeahOmXtOmalOaXtumXtOOAglxyXG4gICAgICog6L+e57ut5aSx6LSlM+asoeWwseS8muaWreW8gOi/nuaOpVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHR5cGUge251bWJlcn1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3BpbmdJbnRlcnZhbDogbnVtYmVyID0gMTAwMCAqIDIwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5pS25Yiw5a6i5oi356uv5Y+R5p2lcGluZ+aXtueahOaXtumXtOaIs1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWNlaXZlZFBpbmc6IG51bWJlciA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDkv53lrZjooqvljIXoo4XnmoRzb2NrZXTlr7nosaFcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUgeyp9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBzb2NrZXQ6IGFueTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdlYlNvY2tldCBzZXJ2ZXIg55qEVVJM5Zyw5Z2AICAgXHJcbiAgICAgKiDms6jmhI/vvJrlpoLmnpzmmK9TZXJ2ZXLnlJ/miJDnmoRTb2NrZXTvvIzliJl1cmzkuLrnqbpcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IHVybDogc3RyaW5nO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5b2T5YmN5o6l5Y+j6L+Q6KGM5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBcclxuICAgICAqIEB0eXBlIHsoXCJicm93c2VyXCIgfCBcIm5vZGVcIil9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBwbGF0Zm9ybTogXCJicm93c2VyXCIgfCBcIm5vZGVcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOi/nuaOpeeahOW9k+WJjeeKtuaAgVxyXG4gICAgICogXHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHR5cGUge1JlYWR5U3RhdGV9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBnZXQgcmVhZHlTdGF0ZSgpOiBSZWFkeVN0YXRlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog6LCD55SoIHNlbmQoKSDmlrnms5XlsIblpJrlrZfoioLmlbDmja7liqDlhaXliLDpmJ/liJfkuK3nrYnlvoXkvKDovpPvvIzkvYbmmK/ov5jmnKrlj5Hlh7rjgILor6XlgLzkvJrlnKjmiYDmnInpmJ/liJfmlbDmja7ooqvlj5HpgIHlkI7ph43nva7kuLogMOOAguiAjOW9k+i/nuaOpeWFs+mXreaXtuS4jeS8muiuvuS4ujDjgILlpoLmnpzmjIHnu63osIPnlKhzZW5kKCnvvIzov5nkuKrlgLzkvJrmjIHnu63lop7plb/jgIJcclxuICAgICAqIFxyXG4gICAgICogQHJlYWRvbmx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBnZXQgYnVmZmVyZWRBbW91bnQoKTogbnVtYmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHsqfSBzb2NrZXQg5a2Q57G75a6e5L6L5YyW55qEc29ja2V05a+56LGhXHJcbiAgICAgKiBAcGFyYW0geyhcImJyb3dzZXJcIiB8IFwibm9kZVwiKX0gcGxhdGZvcm0g5oyH56S66K+l5o6l5Y+j5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VTb2NrZXRDb25maWd9IGNvbmZpZ3Mg6YWN572uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihzb2NrZXQ6IGFueSwgcGxhdGZvcm06IFwiYnJvd3NlclwiIHwgXCJub2RlXCIsIGNvbmZpZ3M6IEJhc2VTb2NrZXRDb25maWcpIHtcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgIHVybCxcclxuICAgICAgICAgICAgc2VuZGluZ1JldHJ5ID0gMyxcclxuICAgICAgICAgICAgc2VuZGluZ1RpbWVvdXQgPSAxMDAwICogNjAsXHJcbiAgICAgICAgICAgIG5lZWREZXNlcmlhbGl6ZSA9IHRydWVcclxuICAgICAgICB9ID0gY29uZmlncztcclxuXHJcbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XHJcbiAgICAgICAgdGhpcy5fc2VuZGluZ1JldHJ5ID0gc2VuZGluZ1JldHJ5O1xyXG4gICAgICAgIHRoaXMuX3NlbmRpbmdUaW1lb3V0ID0gc2VuZGluZ1RpbWVvdXQ7XHJcbiAgICAgICAgdGhpcy5fbmVlZERlc2VyaWFsaXplID0gbmVlZERlc2VyaWFsaXplO1xyXG4gICAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xyXG4gICAgICAgIHRoaXMucGxhdGZvcm0gPSBwbGF0Zm9ybTtcclxuXHJcbiAgICAgICAgdGhpcy5tb25pdG9yUGluZygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5a+56KaB5Y+R6YCB55qE5pWw5o2u6L+b6KGM5bqP5YiX5YyW44CC5rOo5oSP5Y+q5pyJ5L2N5LqO5pWw57uE5qC55LiL55qEYm9vbGVhbuOAgXN0cmluZ+OAgW51bWJlcuOAgXZvaWTjgIFCdWZmZXLmiY3kvJrov5vooYzkuozov5vliLbluo/liJfljJbvvIzlr7nosaHkvJrooqtKU09OLnN0cmluZ2lmeSAgICBcclxuICAgICAqIOaVsOaNruagvOW8j++8miDlhYPntKDnsbvlnosgLT4gW+WFg+e0oOmVv+W6pl0gLT4g5YWD57Sg5YaF5a65XHJcbiAgICAgKiBcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXJpYWxpemUoZGF0YTogYW55W10pOiBCdWZmZXIge1xyXG4gICAgICAgIGNvbnN0IGJ1ZmZlckl0ZW1zOiBCdWZmZXJbXSA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGRhdGEpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgaXRlbSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUubnVtYmVyLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlRG91YmxlQkUoaXRlbSwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlckl0ZW1zLnB1c2godHlwZSwgY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLnN0cmluZywgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExlbmd0aC53cml0ZURvdWJsZUJFKGNvbnRlbnQubGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5ib29sZWFuLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlVUludDgoaXRlbSA/IDEgOiAwLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUudW5kZWZpbmVkLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLm51bGwsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciAmJiAhaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy/pkojlr7lBcnJheUJ1ZmZlcueahOaDheWGtVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHR5cGVkVG9CdWZmZXIoaXRlbSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLkJ1ZmZlciwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBpdGVtO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5CdWZmZXIsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLk9iamVjdCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9CdWZmZXIuY29uY2F0KGJ1ZmZlckl0ZW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWvueaOpeaUtuWIsOeahOa2iOaBr+i/m+ihjOWPjeW6j+WIl+WMllxyXG4gICAgICogXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBkZXNlcmlhbGl6ZShkYXRhOiBCdWZmZXIpOiBhbnlbXSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgbGV0IHByZXZpb3VzID0gMDtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHByZXZpb3VzIDwgZGF0YS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bWJlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuc3RyaW5nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnNsaWNlKHByZXZpb3VzLCBsZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gbGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5ib29sZWFuOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQgPT09IDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS51bmRlZmluZWQ6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5udWxsOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobnVsbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLkJ1ZmZlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKTtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyArPSA4O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChkYXRhLnNsaWNlKHByZXZpb3VzLCBsZW5ndGgpKTtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyArPSBsZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLk9iamVjdDoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKTtcclxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyArPSA4O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS5zbGljZShwcmV2aW91cywgbGVuZ3RoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChKU09OLnBhcnNlKGNvbnRlbnQudG9TdHJpbmcoKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IGxlbmd0aDtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RhdGEgdHlwZSBkb25gdCBleGlzdC4gdHlwZTogJyArIHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqP5YiX5YyW5raI5oGv5aS06YOo44CCICAgIFxyXG4gICAgICog5pWw5o2u5qC85byP77ya5aS06YOo6ZW/5bqmIC0+IOa2iOaBr+WQjeensOmVv+W6piAtPiDmtojmga/lkI3np7AgLT4g6K+l5raI5oGv5piv5ZCm6ZyA6KaB56Gu6K6k5pS25YiwIC0+IFvmtojmga9pZF1cclxuICAgICAqIFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlTmFtZSDmtojmga/nmoTlkI3np7BcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbmVlZEFDSyBcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWVzc2FnZUlEXVxyXG4gICAgICogQHJldHVybnMge0J1ZmZlcn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNlcmlhbGl6ZUhlYWRlcihtZXNzYWdlTmFtZTogc3RyaW5nLCBuZWVkQUNLOiBib29sZWFuLCBtZXNzYWdlSUQ/OiBudW1iZXIpOiBCdWZmZXIge1xyXG4gICAgICAgIGxldCBfaGVhZGVyTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lID0gX0J1ZmZlci5mcm9tKG1lc3NhZ2VOYW1lKTtcclxuICAgICAgICBsZXQgX25lZWRBQ0sgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZUlEID0gbmVlZEFDSyA/IF9CdWZmZXIuYWxsb2MoOCkgOiBfQnVmZmVyLmFsbG9jKDApO1xyXG5cclxuICAgICAgICBfbWVzc2FnZU5hbWVMZW5ndGgud3JpdGVEb3VibGVCRShfbWVzc2FnZU5hbWUubGVuZ3RoLCAwKTtcclxuICAgICAgICBfbmVlZEFDSy53cml0ZVVJbnQ4KG5lZWRBQ0sgPyAxIDogMCwgMCk7XHJcbiAgICAgICAgbmVlZEFDSyAmJiBfbWVzc2FnZUlELndyaXRlRG91YmxlQkUoPGFueT5tZXNzYWdlSUQsIDApO1xyXG5cclxuICAgICAgICBsZXQgbGVuZ3RoID0gX2hlYWRlckxlbmd0aC5sZW5ndGggKyBfbWVzc2FnZU5hbWUubGVuZ3RoICsgX21lc3NhZ2VOYW1lTGVuZ3RoLmxlbmd0aCArIF9uZWVkQUNLLmxlbmd0aCArIF9tZXNzYWdlSUQubGVuZ3RoO1xyXG4gICAgICAgIF9oZWFkZXJMZW5ndGgud3JpdGVEb3VibGVCRShsZW5ndGgsIDApO1xyXG5cclxuICAgICAgICByZXR1cm4gQnVmZmVyLmNvbmNhdChbX2hlYWRlckxlbmd0aCwgX21lc3NhZ2VOYW1lTGVuZ3RoLCBfbWVzc2FnZU5hbWUsIF9uZWVkQUNLLCBfbWVzc2FnZUlEXSwgbGVuZ3RoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWPjeW6j+WIl+WMluWktOmDqFxyXG4gICAgICogQHBhcmFtIGRhdGEg5aS06YOo5LqM6L+b5Yi25pWw5o2uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZGVzZXJpYWxpemVIZWFkZXIoZGF0YTogQnVmZmVyKSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgY29uc3QgaGVhZGVyID0ge1xyXG4gICAgICAgICAgICBtZXNzYWdlTmFtZTogJycsXHJcbiAgICAgICAgICAgIG5lZWRBQ0s6IGZhbHNlLFxyXG4gICAgICAgICAgICBtZXNzYWdlSUQ6IC0xLFxyXG4gICAgICAgICAgICBoZWFkZXJMZW5ndGg6IDBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBoZWFkZXIuaGVhZGVyTGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUoMCk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gODtcclxuXHJcbiAgICAgICAgY29uc3QgbWVzc2FnZU5hbWVMZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShpbmRleCk7XHJcbiAgICAgICAgaW5kZXggKz0gODtcclxuXHJcbiAgICAgICAgaGVhZGVyLm1lc3NhZ2VOYW1lID0gZGF0YS5zbGljZShpbmRleCwgaW5kZXggKyBtZXNzYWdlTmFtZUxlbmd0aCkudG9TdHJpbmcoKTtcclxuICAgICAgICBpbmRleCArPSBtZXNzYWdlTmFtZUxlbmd0aDtcclxuXHJcbiAgICAgICAgaGVhZGVyLm5lZWRBQ0sgPSBkYXRhLnJlYWRVSW50OChpbmRleCsrKSA9PT0gMTtcclxuICAgICAgICBoZWFkZXIubWVzc2FnZUlEID0gZGF0YS5yZWFkRG91YmxlQkUoaW5kZXgpO1xyXG5cclxuICAgICAgICByZXR1cm4gaGVhZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZCv5YqocGluZ+ajgOafpei/nuaOpeaYr+WQpuato+W4uFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBtb25pdG9yUGluZygpIHtcclxuICAgICAgICBsZXQgdGltZXI6IE5vZGVKUy5UaW1lcjtcclxuICAgICAgICBsZXQgbGFzdFRpbWU6IG51bWJlciA9IDA7ICAgIC8v5LiK5LiA5qyh5pS25YiwcGluZ+eahOaXtumXtFxyXG4gICAgICAgIGxldCBmYWlsdXJlc051bWJlciA9IDA7ICAgICAgLy/ov57nu63lpLHotKXnmoTmrKHmlbDjgILmnIDlpJrov57nu60z5qyh5bCx5pat5byA6L+e5o6lXHJcblxyXG4gICAgICAgIHRoaXMub24oJ29wZW4nLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3JlY2VpdmVkUGluZyA+IGxhc3RUaW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdFRpbWUgPSB0aGlzLl9yZWNlaXZlZFBpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgZmFpbHVyZXNOdW1iZXIgPSAwO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmYWlsdXJlc051bWJlcisrID4gMykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ3BpbmfmjqXmlLbnq6/vvIzkuIDliIbpkp/lhoXml6DlupTnrZQnKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX3NlbmRJbnRlcm5hbCgncGluZycpO1xyXG4gICAgICAgICAgICB9LCB0aGlzLl9waW5nSW50ZXJ2YWwpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLm9uKCdjbG9zZScsICgpID0+IHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj5HpgIHmlbDmja7jgILlj5HpgIHlpLHotKXnm7TmjqXmipvlh7rlvILluLhcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VOYW1lIOa2iOaBr+eahOWQjeensCjmoIfpopgpXHJcbiAgICAgKiBAcGFyYW0ge2FueVtdfSBbZGF0YV0g6KaB5Y+R6YCB55qE5pWw5o2u44CC5aaC5p6c5Y+q5Y+R6YCBbWVzc2FnZU5hbWXvvIzmlbDmja7lj6/ku6XnlZnnqbpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW25lZWRBQ0s9dHJ1ZV0g5Y+R5Ye655qE6L+Z5p2h5raI5oGv5piv5ZCm6ZyA6KaB56Gu6K6k5a+55pa55piv5ZCm5bey57uP5pS25YiwXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBzZW5kKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE/OiBhbnlbXSwgbmVlZEFDSzogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gZGF0YSA/IEJhc2VTb2NrZXQuc2VyaWFsaXplKGRhdGEpIDogX0J1ZmZlci5hbGxvYygwKTtcclxuICAgICAgICAgICAgaWYgKG5lZWRBQ0spIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VJRCA9IHRoaXMuX21lc3NhZ2VJRCsrO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gdGhpcy5zZXJpYWxpemVIZWFkZXIobWVzc2FnZU5hbWUsIG5lZWRBQ0ssIG1lc3NhZ2VJRCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gX0J1ZmZlci5jb25jYXQoW2hlYWRlciwgYm9keV0pO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX21lc3NhZ2Uuc2V0KG1lc3NhZ2VJRCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc3NhZ2UuZGVsZXRlKG1lc3NhZ2VJRCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fc2VuZGluZ1JldHJ5OyBpbmRleCsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX21lc3NhZ2UuaGFzKG1lc3NhZ2VJRCkpIHJldHVybjsgICAvL+WIpOaWreWvueaWueaYr+WQpuW3sue7j+aUtuWIsOS6hlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX3NlbmREYXRhKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCB0aGlzLl9zZW5kaW5nVGltZW91dCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihg5Y+R6YCB5pWw5o2u5aSx6LSl44CC5Zyo5bCd6K+VJHt0aGlzLl9zZW5kaW5nUmV0cnl95qyh6YeN5Y+R5LmL5ZCO77yM5o6l5pS256uv5L6d54S25rKh5pyJ5Zue5bqU5pS25Yiw44CCYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzc2FnZS5kZWxldGUobWVzc2FnZUlEKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KSgpLnRoZW4ocmVzb2x2ZSkuY2F0Y2gocmVqZWN0KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuc2VyaWFsaXplSGVhZGVyKG1lc3NhZ2VOYW1lLCBuZWVkQUNLKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NlbmREYXRhKF9CdWZmZXIuY29uY2F0KFtoZWFkZXIsIGJvZHldKSkudGhlbihyZXNvbHZlKS5jYXRjaChyZWplY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlj5HpgIHlhoXpg6jmlbDmja7jgIIgICBcclxuICAgICAqIOazqOaEj++8muaJgOacieWPkemAgeeahOWGhemDqOa2iOaBr+mDveaYr+S4jemcgOimgeWvueaWuemqjOivgeaYr+WQpuaUtuWIsOeahOOAguWmguaenOWPkemAgeaXtuWHuueOsOmUmeivr+S8muiHquWKqOinpuWPkWVycm9y5LqL5Lu2XHJcbiAgICAgKiBcclxuICAgICAqIEBwcm90ZWN0ZWRcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlTmFtZSDmtojmga/lkI3np7BcclxuICAgICAqIEBwYXJhbSB7Li4uYW55W119IGRhdGEg5YW25L2Z5pWw5o2uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3NlbmRJbnRlcm5hbChtZXNzYWdlTmFtZTogc3RyaW5nLCAuLi5kYXRhOiBhbnlbXSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbmQoJ19fYndzX2ludGVybmFsX18nLCBbbWVzc2FnZU5hbWUsIC4uLmRhdGFdLCBmYWxzZSkuY2F0Y2goZXJyID0+IHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmcgOimgeWtkOexu+imhuWGmeOAguiwg+eUqF9zb2NrZXTlj5HpgIHmlbDmja5cclxuICAgICAqIFxyXG4gICAgICogQHByb3RlY3RlZFxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSDopoHlj5HpgIHnmoTmlbDmja5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBhYnN0cmFjdCBfc2VuZERhdGEoZGF0YTogQnVmZmVyKTogUHJvbWlzZTx2b2lkPjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOino+aekOaOpeaUtuWIsOaVsOaNruOAguWtkOexu+aOpeaUtuWIsOa2iOaBr+WQjumcgOimgeinpuWPkei/meS4quaWueazlVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHsqfSBkYXRhIOaOpeaUtuWIsOaVsOaNrlxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9yZWNlaXZlRGF0YShkYXRhOiBCdWZmZXIpIHtcclxuICAgICAgICBjb25zdCBoZWFkZXIgPSB0aGlzLmRlc2VyaWFsaXplSGVhZGVyKGRhdGEpO1xyXG4gICAgICAgIGlmIChoZWFkZXIubWVzc2FnZU5hbWUgPT09ICdfX2J3c19pbnRlcm5hbF9fJykgeyAgICAvL+WmguaenOaOpeaUtuWIsOeahOaYr+WGhemDqOWPkeadpeeahOa2iOaBr1xyXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gQmFzZVNvY2tldC5kZXNlcmlhbGl6ZShkYXRhLnNsaWNlKGhlYWRlci5oZWFkZXJMZW5ndGgpKTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoYm9keVswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnYWNrJzpcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuX21lc3NhZ2UuZ2V0KGJvZHlbMV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICAgICAgY2FzZSAncGluZyc6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVjZWl2ZWRQaW5nID0gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fbmVlZERlc2VyaWFsaXplID8gQmFzZVNvY2tldC5kZXNlcmlhbGl6ZShkYXRhLnNsaWNlKGhlYWRlci5oZWFkZXJMZW5ndGgpKSA6IGRhdGEuc2xpY2UoaGVhZGVyLmhlYWRlckxlbmd0aCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoaGVhZGVyLm5lZWRBQ0spIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9yZWNlaXZlZE1lc3NhZ2VJRCA8IGhlYWRlci5tZXNzYWdlSUQpIHsgICAvL+ehruS/neS4jeS8mumHjeWkjeaOpeaUtlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlY2VpdmVkTWVzc2FnZUlEID0gaGVhZGVyLm1lc3NhZ2VJRDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBoZWFkZXIubWVzc2FnZU5hbWUsIGJvZHkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuX3NlbmRJbnRlcm5hbCgnYWNrJywgaGVhZGVyLm1lc3NhZ2VJRCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBoZWFkZXIubWVzc2FnZU5hbWUsIGJvZHkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5YWz6Zet5o6l5Y+j44CC5YWz6Zet5LmL5ZCO5Lya6Kem5Y+RY2xvc2Xkuovku7ZcclxuICAgICAqIFxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBjbG9zZSgpOiB2b2lkO1xyXG5cclxuICAgIG9uKGV2ZW50OiAnZXJyb3InLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+aUtuWIsOa2iOaBr1xyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ21lc3NhZ2UnLCBjYjogKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPov57mjqXlu7rnq4tcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdvcGVuJywgY2I6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbihldmVudDogJ2Nsb3NlJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBvbmNlKGV2ZW50OiAnZXJyb3InLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+aUtuWIsOa2iOaBr1xyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnbWVzc2FnZScsIGNiOiAobWVzc2FnZU5hbWU6IHN0cmluZywgZGF0YTogYW55W10pID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+i/nuaOpeW7uueri1xyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnb3BlbicsIGNiOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogJ2Nsb3NlJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzIHtcclxuICAgICAgICBzdXBlci5vbmNlKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn0iXX0=
