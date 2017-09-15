"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Emitter = require("component-emitter");
const isBuffer = require('is-buffer');
const _Buffer = Buffer ? Buffer : require('buffer/').Buffer; // 确保浏览器下也能使用Buffer
const typedToBuffer = require('typedarray-to-buffer');
const ReadyState_1 = require("./ReadyState");
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
        if (needACK)
            _messageID.writeDoubleBE(messageID, 0);
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
        if (header.needACK)
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
        const start = () => {
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
        };
        if (this.readyState === ReadyState_1.ReadyState.OPEN) {
            start();
        }
        else {
            this.on('open', start);
        }
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
            console.log(this.id, body);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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T0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDakIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUM3QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztvQkFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbkQsQ0FBQztnQkFFRCxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDaEQsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBcUJELEVBQUUsQ0FBQyxLQUFhLEVBQUUsUUFBa0I7UUFDaEMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0lBWUQsSUFBSSxDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUNsQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7Q0FDSjtBQTFnQkQsZ0NBMGdCQyIsImZpbGUiOiJjb21tb24vQmFzZVNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEVtaXR0ZXIgZnJvbSAnY29tcG9uZW50LWVtaXR0ZXInO1xyXG5jb25zdCBpc0J1ZmZlciA9IHJlcXVpcmUoJ2lzLWJ1ZmZlcicpO1xyXG5jb25zdCBfQnVmZmVyOiB0eXBlb2YgQnVmZmVyID0gQnVmZmVyID8gQnVmZmVyIDogcmVxdWlyZSgnYnVmZmVyLycpLkJ1ZmZlcjsgIC8vIOehruS/nea1j+iniOWZqOS4i+S5n+iDveS9v+eUqEJ1ZmZlclxyXG5jb25zdCB0eXBlZFRvQnVmZmVyID0gcmVxdWlyZSgndHlwZWRhcnJheS10by1idWZmZXInKTtcclxuXHJcbmltcG9ydCB7IFJlYWR5U3RhdGUgfSBmcm9tIFwiLi9SZWFkeVN0YXRlXCI7XHJcbmltcG9ydCB7IEJhc2VTb2NrZXRDb25maWcgfSBmcm9tICcuL0Jhc2VTb2NrZXRDb25maWcnO1xyXG5pbXBvcnQgeyBEYXRhVHlwZSB9IGZyb20gJy4uL2NvbW1vbi9EYXRhVHlwZSc7XHJcblxyXG4vKipcclxuICogU29ja2V0IOaOpeWPo+eahOaKveixoeexu++8jOWumuS5ieS6hnNvY2tldOmcgOimgeWunueOsOeahOWfuuehgOWKn+iDvVxyXG4gKi9cclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VTb2NrZXQgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIF9tZXNzYWdlSUQg55qESUTlj7fvvIxpZOS7jjDlvIDlp4vjgILmr4/lj5HkuIDmnaFuZWVkQUNL55qE5raI5oGv77yM6K+laWTliqAxXHJcbiAgICAgKiBcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9tZXNzYWdlSUQgPSAwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5o6l5pS25Yiw55qEbWVzc2FnZUlE57yW5Y+3XHJcbiAgICAgKiBcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWNlaXZlZE1lc3NhZ2VJRCA9IC0xO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y5o6l5pS25o6l5pS256uv5Y+R5Zue55qE56Gu6K6k5raI5oGv55qE5Zue6LCD5Ye95pWwXHJcbiAgICAgKiBrZXk6X21lc3NhZ2VJRFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZTogTWFwPG51bWJlciwgRnVuY3Rpb24+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3NlbmRpbmdUaW1lb3V0OiBudW1iZXI7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfc2VuZGluZ1JldHJ5OiBudW1iZXI7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfbmVlZERlc2VyaWFsaXplOiBib29sZWFuO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Y+R6YCBcGluZ+adpeajgOafpei/nuaOpeaYr+WQpuato+W4uOeahOmXtOmalOaXtumXtOOAglxyXG4gICAgICog6L+e57ut5aSx6LSlM+asoeWwseS8muaWreW8gOi/nuaOpVxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHR5cGUge251bWJlcn1cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3BpbmdJbnRlcnZhbDogbnVtYmVyID0gMTAwMCAqIDIwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5pS25Yiw5a6i5oi356uv5Y+R5p2lcGluZ+aXtueahOaXtumXtOaIs1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWNlaXZlZFBpbmc6IG51bWJlciA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDkv53lrZjooqvljIXoo4XnmoRzb2NrZXTlr7nosaFcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUgeyp9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBzb2NrZXQ6IGFueTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdlYlNvY2tldCBzZXJ2ZXIg55qEVVJM5Zyw5Z2AICAgXHJcbiAgICAgKiDms6jmhI/vvJrlpoLmnpzmmK9TZXJ2ZXLnlJ/miJDnmoRTb2NrZXTvvIzliJl1cmzkuLrnqbpcclxuICAgICAqIFxyXG4gICAgICogQHR5cGUge3N0cmluZ31cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IHVybDogc3RyaW5nO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5b2T5YmN5o6l5Y+j6L+Q6KGM5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBcclxuICAgICAqIEB0eXBlIHsoXCJicm93c2VyXCIgfCBcIm5vZGVcIil9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBwbGF0Zm9ybTogXCJicm93c2VyXCIgfCBcIm5vZGVcIjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOi/nuaOpeeahOW9k+WJjeeKtuaAgVxyXG4gICAgICogXHJcbiAgICAgKiBAcmVhZG9ubHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHR5cGUge1JlYWR5U3RhdGV9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBnZXQgcmVhZHlTdGF0ZSgpOiBSZWFkeVN0YXRlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog6LCD55SoIHNlbmQoKSDmlrnms5XlsIblpJrlrZfoioLmlbDmja7liqDlhaXliLDpmJ/liJfkuK3nrYnlvoXkvKDovpPvvIzkvYbmmK/ov5jmnKrlj5Hlh7rjgILor6XlgLzkvJrlnKjmiYDmnInpmJ/liJfmlbDmja7ooqvlj5HpgIHlkI7ph43nva7kuLogMOOAguiAjOW9k+i/nuaOpeWFs+mXreaXtuS4jeS8muiuvuS4ujDjgILlpoLmnpzmjIHnu63osIPnlKhzZW5kKCnvvIzov5nkuKrlgLzkvJrmjIHnu63lop7plb/jgIJcclxuICAgICAqIFxyXG4gICAgICogQHJlYWRvbmx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBnZXQgYnVmZmVyZWRBbW91bnQoKTogbnVtYmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHBhcmFtIHsqfSBzb2NrZXQg5a2Q57G75a6e5L6L5YyW55qEc29ja2V05a+56LGhXHJcbiAgICAgKiBAcGFyYW0geyhcImJyb3dzZXJcIiB8IFwibm9kZVwiKX0gcGxhdGZvcm0g5oyH56S66K+l5o6l5Y+j5omA5aSE55qE5bmz5Y+wXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VTb2NrZXRDb25maWd9IGNvbmZpZ3Mg6YWN572uXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihzb2NrZXQ6IGFueSwgcGxhdGZvcm06IFwiYnJvd3NlclwiIHwgXCJub2RlXCIsIGNvbmZpZ3M6IEJhc2VTb2NrZXRDb25maWcpIHtcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICBjb25zdCB7XHJcbiAgICAgICAgICAgIHVybCxcclxuICAgICAgICAgICAgc2VuZGluZ1JldHJ5ID0gMyxcclxuICAgICAgICAgICAgc2VuZGluZ1RpbWVvdXQgPSAxMDAwICogNjAsXHJcbiAgICAgICAgICAgIG5lZWREZXNlcmlhbGl6ZSA9IHRydWVcclxuICAgICAgICB9ID0gY29uZmlncztcclxuXHJcbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XHJcbiAgICAgICAgdGhpcy5fc2VuZGluZ1JldHJ5ID0gc2VuZGluZ1JldHJ5O1xyXG4gICAgICAgIHRoaXMuX3NlbmRpbmdUaW1lb3V0ID0gc2VuZGluZ1RpbWVvdXQ7XHJcbiAgICAgICAgdGhpcy5fbmVlZERlc2VyaWFsaXplID0gbmVlZERlc2VyaWFsaXplO1xyXG4gICAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xyXG4gICAgICAgIHRoaXMucGxhdGZvcm0gPSBwbGF0Zm9ybTtcclxuXHJcbiAgICAgICAgdGhpcy5tb25pdG9yUGluZygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5a+56KaB5Y+R6YCB55qE5pWw5o2u6L+b6KGM5bqP5YiX5YyW44CC5rOo5oSP5Y+q5pyJ5L2N5LqO5pWw57uE5qC55LiL55qEYm9vbGVhbuOAgXN0cmluZ+OAgW51bWJlcuOAgXZvaWTjgIFCdWZmZXLmiY3kvJrov5vooYzkuozov5vliLbluo/liJfljJbvvIzlr7nosaHkvJrooqtKU09OLnN0cmluZ2lmeSAgICBcclxuICAgICAqIOaVsOaNruagvOW8j++8miDlhYPntKDnsbvlnosgLT4gW+WFg+e0oOmVv+W6pl0gLT4g5YWD57Sg5YaF5a65XHJcbiAgICAgKiBcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXJpYWxpemUoZGF0YTogYW55W10pOiBCdWZmZXIge1xyXG4gICAgICAgIGNvbnN0IGJ1ZmZlckl0ZW1zOiBCdWZmZXJbXSA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGRhdGEpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlb2YgaXRlbSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUubnVtYmVyLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlRG91YmxlQkUoaXRlbSwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZlckl0ZW1zLnB1c2godHlwZSwgY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShpdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLnN0cmluZywgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudExlbmd0aC53cml0ZURvdWJsZUJFKGNvbnRlbnQubGVuZ3RoLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5ib29sZWFuLCAwKTtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LndyaXRlVUludDgoaXRlbSA/IDEgOiAwLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlLndyaXRlVUludDgoRGF0YVR5cGUudW5kZWZpbmVkLCAwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLm51bGwsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciAmJiAhaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy/pkojlr7lBcnJheUJ1ZmZlcueahOaDheWGtVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHR5cGVkVG9CdWZmZXIoaXRlbSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLkJ1ZmZlciwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNCdWZmZXIoaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IF9CdWZmZXIuYWxsb2MoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBpdGVtO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUud3JpdGVVSW50OChEYXRhVHlwZS5CdWZmZXIsIDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoLndyaXRlRG91YmxlQkUoY29udGVudC5sZW5ndGgsIDApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVySXRlbXMucHVzaCh0eXBlLCBjb250ZW50TGVuZ3RoLCBjb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlID0gX0J1ZmZlci5hbGxvYygxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IF9CdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBfQnVmZmVyLmFsbG9jKDgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZS53cml0ZVVJbnQ4KERhdGFUeXBlLk9iamVjdCwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGgud3JpdGVEb3VibGVCRShjb250ZW50Lmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJJdGVtcy5wdXNoKHR5cGUsIGNvbnRlbnRMZW5ndGgsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIF9CdWZmZXIuY29uY2F0KGJ1ZmZlckl0ZW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWvueaOpeaUtuWIsOeahOa2iOaBr+i/m+ihjOWPjeW6j+WIl+WMllxyXG4gICAgICogXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAcGFyYW0ge0J1ZmZlcn0gZGF0YSBcclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBkZXNlcmlhbGl6ZShkYXRhOiBCdWZmZXIpOiBhbnlbXSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgbGV0IHByZXZpb3VzID0gMDtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHByZXZpb3VzIDwgZGF0YS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGRhdGEucmVhZFVJbnQ4KHByZXZpb3VzKyspO1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bWJlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEucmVhZERvdWJsZUJFKHByZXZpb3VzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuc3RyaW5nOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnNsaWNlKHByZXZpb3VzLCBwcmV2aW91cyArPSBsZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNvbnRlbnQudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLmJvb2xlYW46IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS5yZWFkVUludDgocHJldmlvdXMrKyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goY29udGVudCA9PT0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLnVuZGVmaW5lZDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlIERhdGFUeXBlLm51bGw6IHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhc2UgRGF0YVR5cGUuQnVmZmVyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUocHJldmlvdXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IDg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSBEYXRhVHlwZS5PYmplY3Q6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShwcmV2aW91cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gODtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEuc2xpY2UocHJldmlvdXMsIHByZXZpb3VzICs9IGxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goSlNPTi5wYXJzZShjb250ZW50LnRvU3RyaW5nKCkpKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2RhdGEgdHlwZSBkb25gdCBleGlzdC4gdHlwZTogJyArIHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqP5YiX5YyW5raI5oGv5aS06YOo44CCICAgIFxyXG4gICAgICog5pWw5o2u5qC85byP77ya5aS06YOo6ZW/5bqmIC0+IOa2iOaBr+WQjeensOmVv+W6piAtPiDmtojmga/lkI3np7AgLT4g6K+l5raI5oGv5piv5ZCm6ZyA6KaB56Gu6K6k5pS25YiwIC0+IFvmtojmga9pZF1cclxuICAgICAqIFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlTmFtZSDmtojmga/nmoTlkI3np7BcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbmVlZEFDSyBcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWVzc2FnZUlEXVxyXG4gICAgICogQHJldHVybnMge0J1ZmZlcn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNlcmlhbGl6ZUhlYWRlcihtZXNzYWdlTmFtZTogc3RyaW5nLCBuZWVkQUNLOiBib29sZWFuLCBtZXNzYWdlSUQ/OiBudW1iZXIpOiBCdWZmZXIge1xyXG4gICAgICAgIGxldCBfaGVhZGVyTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lTGVuZ3RoID0gX0J1ZmZlci5hbGxvYyg4KTtcclxuICAgICAgICBsZXQgX21lc3NhZ2VOYW1lID0gX0J1ZmZlci5mcm9tKG1lc3NhZ2VOYW1lKTtcclxuICAgICAgICBsZXQgX25lZWRBQ0sgPSBfQnVmZmVyLmFsbG9jKDEpO1xyXG4gICAgICAgIGxldCBfbWVzc2FnZUlEID0gbmVlZEFDSyA/IF9CdWZmZXIuYWxsb2MoOCkgOiBfQnVmZmVyLmFsbG9jKDApO1xyXG5cclxuICAgICAgICBfbWVzc2FnZU5hbWVMZW5ndGgud3JpdGVEb3VibGVCRShfbWVzc2FnZU5hbWUubGVuZ3RoLCAwKTtcclxuICAgICAgICBfbmVlZEFDSy53cml0ZVVJbnQ4KG5lZWRBQ0sgPyAxIDogMCwgMCk7XHJcblxyXG4gICAgICAgIGlmIChuZWVkQUNLKVxyXG4gICAgICAgICAgICBfbWVzc2FnZUlELndyaXRlRG91YmxlQkUoPGFueT5tZXNzYWdlSUQsIDApO1xyXG5cclxuICAgICAgICBsZXQgbGVuZ3RoID0gX2hlYWRlckxlbmd0aC5sZW5ndGggKyBfbWVzc2FnZU5hbWUubGVuZ3RoICsgX21lc3NhZ2VOYW1lTGVuZ3RoLmxlbmd0aCArIF9uZWVkQUNLLmxlbmd0aCArIF9tZXNzYWdlSUQubGVuZ3RoO1xyXG4gICAgICAgIF9oZWFkZXJMZW5ndGgud3JpdGVEb3VibGVCRShsZW5ndGgsIDApO1xyXG5cclxuICAgICAgICByZXR1cm4gQnVmZmVyLmNvbmNhdChbX2hlYWRlckxlbmd0aCwgX21lc3NhZ2VOYW1lTGVuZ3RoLCBfbWVzc2FnZU5hbWUsIF9uZWVkQUNLLCBfbWVzc2FnZUlEXSwgbGVuZ3RoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWPjeW6j+WIl+WMluWktOmDqFxyXG4gICAgICogQHBhcmFtIGRhdGEg5aS06YOo5LqM6L+b5Yi25pWw5o2uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZGVzZXJpYWxpemVIZWFkZXIoZGF0YTogQnVmZmVyKSB7XHJcbiAgICAgICAgaWYgKCFpc0J1ZmZlcihkYXRhKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfkvKDlhaXnmoTmlbDmja7nsbvlnovkuI3mmK9CdWZmZXInKTtcclxuXHJcbiAgICAgICAgY29uc3QgaGVhZGVyID0ge1xyXG4gICAgICAgICAgICBtZXNzYWdlTmFtZTogJycsXHJcbiAgICAgICAgICAgIG5lZWRBQ0s6IGZhbHNlLFxyXG4gICAgICAgICAgICBtZXNzYWdlSUQ6IC0xLFxyXG4gICAgICAgICAgICBoZWFkZXJMZW5ndGg6IDBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBoZWFkZXIuaGVhZGVyTGVuZ3RoID0gZGF0YS5yZWFkRG91YmxlQkUoMCk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gODtcclxuXHJcbiAgICAgICAgY29uc3QgbWVzc2FnZU5hbWVMZW5ndGggPSBkYXRhLnJlYWREb3VibGVCRShpbmRleCk7XHJcbiAgICAgICAgaW5kZXggKz0gODtcclxuXHJcbiAgICAgICAgaGVhZGVyLm1lc3NhZ2VOYW1lID0gZGF0YS5zbGljZShpbmRleCwgaW5kZXggKyBtZXNzYWdlTmFtZUxlbmd0aCkudG9TdHJpbmcoKTtcclxuICAgICAgICBpbmRleCArPSBtZXNzYWdlTmFtZUxlbmd0aDtcclxuXHJcbiAgICAgICAgaGVhZGVyLm5lZWRBQ0sgPSBkYXRhLnJlYWRVSW50OChpbmRleCsrKSA9PT0gMTtcclxuXHJcbiAgICAgICAgaWYgKGhlYWRlci5uZWVkQUNLKVxyXG4gICAgICAgICAgICBoZWFkZXIubWVzc2FnZUlEID0gZGF0YS5yZWFkRG91YmxlQkUoaW5kZXgpO1xyXG5cclxuICAgICAgICByZXR1cm4gaGVhZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZCv5YqocGluZ+ajgOafpei/nuaOpeaYr+WQpuato+W4uFxyXG4gICAgICogXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBtb25pdG9yUGluZygpIHtcclxuICAgICAgICBsZXQgdGltZXI6IE5vZGVKUy5UaW1lcjtcclxuICAgICAgICBsZXQgbGFzdFRpbWU6IG51bWJlciA9IDA7ICAgIC8v5LiK5LiA5qyh5pS25YiwcGluZ+eahOaXtumXtFxyXG4gICAgICAgIGxldCBmYWlsdXJlc051bWJlciA9IDA7ICAgICAgLy/ov57nu63lpLHotKXnmoTmrKHmlbDjgILmnIDlpJrov57nu60z5qyh5bCx5pat5byA6L+e5o6lXHJcblxyXG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gKCkgPT4geyAgLy8g5byA5aeL5Y+R6YCBcGluZ1xyXG4gICAgICAgICAgICB0aW1lciA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9yZWNlaXZlZFBpbmcgPiBsYXN0VGltZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxhc3RUaW1lID0gdGhpcy5fcmVjZWl2ZWRQaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgIGZhaWx1cmVzTnVtYmVyID0gMDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmFpbHVyZXNOdW1iZXIrKyA+IDMpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdwaW5n5o6l5pS256uv77yM5LiA5YiG6ZKf5YaF5peg5bqU562UJykpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zZW5kSW50ZXJuYWwoJ3BpbmcnKTtcclxuICAgICAgICAgICAgfSwgdGhpcy5fcGluZ0ludGVydmFsKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSBSZWFkeVN0YXRlLk9QRU4pIHsgIC8vc2VydmVy5YaF6YOo5Yib5bu655qEc29ja2V05LiA5Ye65p2l5bCx5pivb3BlbueKtuaAgeeahO+8jOaJgOS7peS4jeS8muinpuWPkW9wZW7kuovku7ZcclxuICAgICAgICAgICAgc3RhcnQoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLm9uKCdvcGVuJywgc3RhcnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5vbignY2xvc2UnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Y+R6YCB5pWw5o2u44CC5Y+R6YCB5aSx6LSl55u05o6l5oqb5Ye65byC5bi4XHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlTmFtZSDmtojmga/nmoTlkI3np7Ao5qCH6aKYKVxyXG4gICAgICogQHBhcmFtIHthbnlbXX0gW2RhdGFdIOimgeWPkemAgeeahOaVsOaNruOAguWmguaenOWPquWPkemAgW1lc3NhZ2VOYW1l77yM5pWw5o2u5Y+v5Lul55WZ56m6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtuZWVkQUNLPXRydWVdIOWPkeWHuueahOi/meadoea2iOaBr+aYr+WQpumcgOimgeehruiupOWvueaWueaYr+WQpuW3sue7j+aUtuWIsFxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8dm9pZD59IFxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgc2VuZChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhPzogYW55W10sIG5lZWRBQ0s6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IGRhdGEgPyBCYXNlU29ja2V0LnNlcmlhbGl6ZShkYXRhKSA6IF9CdWZmZXIuYWxsb2MoMCk7XHJcbiAgICAgICAgICAgIGlmIChuZWVkQUNLKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlSUQgPSB0aGlzLl9tZXNzYWdlSUQrKztcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuc2VyaWFsaXplSGVhZGVyKG1lc3NhZ2VOYW1lLCBuZWVkQUNLLCBtZXNzYWdlSUQpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IF9CdWZmZXIuY29uY2F0KFtoZWFkZXIsIGJvZHldKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNzYWdlLnNldChtZXNzYWdlSUQsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNzYWdlLmRlbGV0ZShtZXNzYWdlSUQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIChhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX3NlbmRpbmdSZXRyeTsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9tZXNzYWdlLmhhcyhtZXNzYWdlSUQpKSByZXR1cm47ICAgLy/liKTmlq3lr7nmlrnmmK/lkKblt7Lnu4/mlLbliLDkuoZcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9zZW5kRGF0YShkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlcyA9PiBzZXRUaW1lb3V0KHJlcywgdGhpcy5fc2VuZGluZ1RpbWVvdXQpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYOWPkemAgeaVsOaNruWksei0peOAguWcqOWwneivlSR7dGhpcy5fc2VuZGluZ1JldHJ5feasoemHjeWPkeS5i+WQju+8jOaOpeaUtuerr+S+neeEtuayoeacieWbnuW6lOaUtuWIsOOAgmApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc3NhZ2UuZGVsZXRlKG1lc3NhZ2VJRCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSkoKS50aGVuKHJlc29sdmUpLmNhdGNoKHJlamVjdCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXIgPSB0aGlzLnNlcmlhbGl6ZUhlYWRlcihtZXNzYWdlTmFtZSwgbmVlZEFDSyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zZW5kRGF0YShfQnVmZmVyLmNvbmNhdChbaGVhZGVyLCBib2R5XSkpLnRoZW4ocmVzb2x2ZSkuY2F0Y2gocmVqZWN0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Y+R6YCB5YaF6YOo5pWw5o2u44CCICAgXHJcbiAgICAgKiDms6jmhI/vvJrmiYDmnInlj5HpgIHnmoTlhoXpg6jmtojmga/pg73mmK/kuI3pnIDopoHlr7nmlrnpqozor4HmmK/lkKbmlLbliLDnmoTjgILlpoLmnpzlj5HpgIHml7blh7rnjrDplJnor6/kvJroh6rliqjop6blj5FlcnJvcuS6i+S7tlxyXG4gICAgICogXHJcbiAgICAgKiBAcHJvdGVjdGVkXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZU5hbWUg5raI5oGv5ZCN56ewXHJcbiAgICAgKiBAcGFyYW0gey4uLmFueVtdfSBkYXRhIOWFtuS9meaVsOaNrlxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9zZW5kSW50ZXJuYWwobWVzc2FnZU5hbWU6IHN0cmluZywgLi4uZGF0YTogYW55W10pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZW5kKCdfX2J3c19pbnRlcm5hbF9fJywgW21lc3NhZ2VOYW1lLCAuLi5kYXRhXSwgZmFsc2UpLmNhdGNoKGVyciA9PiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDpnIDopoHlrZDnsbvopoblhpnjgILosIPnlKhfc29ja2V05Y+R6YCB5pWw5o2uXHJcbiAgICAgKiBcclxuICAgICAqIEBwcm90ZWN0ZWRcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHBhcmFtIHtCdWZmZXJ9IGRhdGEg6KaB5Y+R6YCB55qE5pWw5o2uXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgQmFzZVNvY2tldFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgYWJzdHJhY3QgX3NlbmREYXRhKGRhdGE6IEJ1ZmZlcik6IFByb21pc2U8dm9pZD47XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDop6PmnpDmjqXmlLbliLDmlbDmja7jgILlrZDnsbvmjqXmlLbliLDmtojmga/lkI7pnIDopoHop6blj5Hov5nkuKrmlrnms5VcclxuICAgICAqIFxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7Kn0gZGF0YSDmjqXmlLbliLDmlbDmja5cclxuICAgICAqIEBtZW1iZXJvZiBCYXNlU29ja2V0XHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfcmVjZWl2ZURhdGEoZGF0YTogQnVmZmVyKSB7XHJcbiAgICAgICAgY29uc3QgaGVhZGVyID0gdGhpcy5kZXNlcmlhbGl6ZUhlYWRlcihkYXRhKTtcclxuICAgICAgICBpZiAoaGVhZGVyLm1lc3NhZ2VOYW1lID09PSAnX19id3NfaW50ZXJuYWxfXycpIHsgICAgLy/lpoLmnpzmjqXmlLbliLDnmoTmmK/lhoXpg6jlj5HmnaXnmoTmtojmga9cclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IEJhc2VTb2NrZXQuZGVzZXJpYWxpemUoZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKSk7XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygoPGFueT50aGlzKS5pZCwgYm9keSk7XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGJvZHlbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ2Fjayc6XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSB0aGlzLl9tZXNzYWdlLmdldChib2R5WzFdKTtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjaygpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BpbmcnOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlY2VpdmVkUGluZyA9IChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX25lZWREZXNlcmlhbGl6ZSA/IEJhc2VTb2NrZXQuZGVzZXJpYWxpemUoZGF0YS5zbGljZShoZWFkZXIuaGVhZGVyTGVuZ3RoKSkgOiBkYXRhLnNsaWNlKGhlYWRlci5oZWFkZXJMZW5ndGgpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGhlYWRlci5uZWVkQUNLKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcmVjZWl2ZWRNZXNzYWdlSUQgPCBoZWFkZXIubWVzc2FnZUlEKSB7ICAgLy/noa7kv53kuI3kvJrph43lpI3mjqXmlLZcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWNlaXZlZE1lc3NhZ2VJRCA9IGhlYWRlci5tZXNzYWdlSUQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgaGVhZGVyLm1lc3NhZ2VOYW1lLCBib2R5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zZW5kSW50ZXJuYWwoJ2FjaycsIGhlYWRlci5tZXNzYWdlSUQpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgaGVhZGVyLm1lc3NhZ2VOYW1lLCBib2R5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWFs+mXreaOpeWPo+OAguWFs+mXreS5i+WQjuS8muinpuWPkWNsb3Nl5LqL5Lu2XHJcbiAgICAgKiBcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICogQHJldHVybnMge3ZvaWR9IFxyXG4gICAgICogQG1lbWJlcm9mIEJhc2VTb2NrZXRcclxuICAgICAqL1xyXG4gICAgYWJzdHJhY3QgY2xvc2UoKTogdm9pZDtcclxuXHJcbiAgICBvbihldmVudDogJ2Vycm9yJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmlLbliLDmtojmga9cclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdtZXNzYWdlJywgY2I6IChtZXNzYWdlTmFtZTogc3RyaW5nLCBkYXRhOiBhbnlbXSkgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T6L+e5o6l5bu656uLXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnb3BlbicsIGNiOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6ICdjbG9zZScsIGNiOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgb25jZShldmVudDogJ2Vycm9yJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmlLbliLDmtojmga9cclxuICAgICAqL1xyXG4gICAgb25jZShldmVudDogJ21lc3NhZ2UnLCBjYjogKG1lc3NhZ2VOYW1lOiBzdHJpbmcsIGRhdGE6IGFueVtdKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPov57mjqXlu7rnq4tcclxuICAgICAqL1xyXG4gICAgb25jZShldmVudDogJ29wZW4nLCBjYjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6ICdjbG9zZScsIGNiOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub25jZShldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59Il19
