"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WS = require("ws");
const Emitter = require("component-emitter");
const http = require("http");
const https = require("https");
const Socket_1 = require("./Socket");
class Server extends Emitter {
    constructor(...args) {
        super();
        /**
         * 保存所有客户端连接。key是socket.id
         */
        this.clients = new Map();
        const config = {
            host: '0.0.0.0',
            port: 8080,
            verifyClient: (info, cb) => {
                this.verifyClient(info.req, info.origin, info.secure).then((result => {
                    if (typeof result === 'boolean') {
                        cb(result);
                    }
                    else {
                        cb(result.res, result.code, result.message);
                    }
                }));
            }
        };
        if (args[0] instanceof http.Server || args[0] instanceof https.Server) {
            config.server = args[0];
        }
        else if (typeof args[0] === 'number') {
            config.port = args[0];
        }
        else if (typeof args[0] === 'string') {
            config.host = args[0];
            if (typeof args[1] === 'number')
                config.port = args[1];
        }
        else if (typeof args[0] === 'object') {
            Object.assign(config, args[0]);
        }
        if (config.server) {
            config.host = undefined; //必须清除，否则WS内部会另外创建一个http server
            config.port = undefined;
        }
        this.ws = new WS.Server(config);
        this.ws.on('error', this.emit.bind(this, 'error'));
        this.ws.once('listening', this.emit.bind(this, 'listening'));
        this.ws._server.once('close', this.emit.bind(this, 'close')); //ws内部会把创建或绑定的http server 保存到_server中
        this.ws.on('connection', (client) => {
            const socket = new Socket_1.Socket(client);
            this.clients.set(socket.id, socket);
            this.emit('connection', socket);
            socket.on('close', () => {
                this.clients.delete(socket.id);
            });
        });
    }
    /**
     * 判断是否接受新的连接。
     * 返回true表示接受，返回false表示拒绝。也可以返回一个对象，提供更多信息。
     *
     * 返回对象：
     *      res {Boolean} Whether or not to accept the handshake.
     *      code {Number} When result is false this field determines the HTTP error status code to be sent to the client.
     *      name {String} When result is false this field determines the HTTP reason phrase.
     *
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @returns {Promise<boolean | { res: boolean, code?: number, message?: string }>}
     * @memberof Server
     */
    verifyClient(req, origin, secure) {
        return Promise.resolve(true);
    }
    /**
     * 关闭服务器，并断开所有的客户端连接
     *
     * @returns {void}
     * @memberof Server
     */
    close() {
        const server = this.ws._server;
        this.ws.close();
        server.close(); //ws不会吧绑定的server关掉，所以这里再次关闭一下
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
exports.Server = Server;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RSxRQUFrQjtRQUNoQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFZRCxJQUFJLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztDQUNKO0FBaEtELHdCQWdLQyIsImZpbGUiOiJzZXJ2ZXIvU2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgV1MgZnJvbSAnd3MnO1xyXG5pbXBvcnQgKiBhcyBFbWl0dGVyIGZyb20gJ2NvbXBvbmVudC1lbWl0dGVyJztcclxuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcclxuaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5pbXBvcnQgeyBTZXJ2ZXJDb25maWcgfSBmcm9tICcuL1NlcnZlckNvbmZpZyc7XHJcbmltcG9ydCB7IFNvY2tldCB9IGZyb20gJy4vU29ja2V0JztcclxuXHJcbmV4cG9ydCBjbGFzcyBTZXJ2ZXIgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOiiq+WMheijheeahHdlYnNvY2tldOWvueixoVxyXG4gICAgICogXHJcbiAgICAgKiBAdHlwZSB7V1MuU2VydmVyfVxyXG4gICAgICogQG1lbWJlcm9mIFNlcnZlclxyXG4gICAgICovXHJcbiAgICByZWFkb25seSB3czogV1MuU2VydmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y5omA5pyJ5a6i5oi356uv6L+e5o6l44CCa2V55pivc29ja2V0LmlkXHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IGNsaWVudHM6IE1hcDxudW1iZXIsIFNvY2tldD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7p3ZWJzb2NrZXTmnI3liqHlmajjgIJcclxuICAgICAqIEBtZW1iZXJvZiBTZXJ2ZXJcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IoKVxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7p3ZWJzb2NrZXTmnI3liqHlmajjgIJcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBob3N0IOebkeWQrOeahOS4u+acuuWcsOWdgFxyXG4gICAgICogQG1lbWJlcm9mIFNlcnZlclxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihob3N0OiBzdHJpbmcpXHJcbiAgICAvKipcclxuICAgICAqIOWIm+W7undlYnNvY2tldOacjeWKoeWZqOOAglxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBvcnQg55uR5ZCs55qE56uv5Y+jXHJcbiAgICAgKiBAbWVtYmVyb2YgU2VydmVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHBvcnQ6IG51bWJlcilcclxuICAgIC8qKlxyXG4gICAgICog5Yib5bu6d2Vic29ja2V05pyN5Yqh5Zmo44CCXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaG9zdCDnm5HlkKznmoTkuLvmnLrlnLDlnYBcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwb3J0IOebkeWQrOeahOerr+WPo1xyXG4gICAgICogQG1lbWJlcm9mIFNlcnZlclxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihob3N0OiBzdHJpbmcsIHBvcnQ6IG51bWJlcilcclxuICAgIC8qKlxyXG4gICAgICog5Yib5bu6d2Vic29ja2V05pyN5Yqh5Zmo44CCXHJcbiAgICAgKiBAcGFyYW0geyhodHRwLlNlcnZlciB8IGh0dHBzLlNlcnZlcil9IHNlcnZlciDnu5HlrprliLDmjIflrprnmoRodHRw5pyN5Yqh5Zmo5LmL5LiKXHJcbiAgICAgKiBAbWVtYmVyb2YgU2VydmVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHNlcnZlcjogaHR0cC5TZXJ2ZXIgfCBodHRwcy5TZXJ2ZXIpXHJcbiAgICAvKipcclxuICAgICAqIOWIm+W7undlYnNvY2tldOacjeWKoeWZqOOAglxyXG4gICAgICogQHBhcmFtIHtTZXJ2ZXJDb25maWd9IG9wdGlvbnMg5pyN5Yqh5Zmo6YWN572uXHJcbiAgICAgKiBAbWVtYmVyb2YgU2VydmVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFNlcnZlckNvbmZpZylcclxuICAgIGNvbnN0cnVjdG9yKC4uLmFyZ3M6IGFueVtdKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgY29uc3QgY29uZmlnOiBTZXJ2ZXJDb25maWcgJiB7IHZlcmlmeUNsaWVudDogV1MuVmVyaWZ5Q2xpZW50Q2FsbGJhY2tBc3luYyB9ID0ge1xyXG4gICAgICAgICAgICBob3N0OiAnMC4wLjAuMCcsXHJcbiAgICAgICAgICAgIHBvcnQ6IDgwODAsXHJcbiAgICAgICAgICAgIHZlcmlmeUNsaWVudDogKGluZm8sIGNiKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZlcmlmeUNsaWVudChpbmZvLnJlcSwgaW5mby5vcmlnaW4sIGluZm8uc2VjdXJlKS50aGVuKChyZXN1bHQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2IocmVzdWx0KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYihyZXN1bHQucmVzLCByZXN1bHQuY29kZSwgcmVzdWx0Lm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChhcmdzWzBdIGluc3RhbmNlb2YgKDxhbnk+aHR0cCkuU2VydmVyIHx8IGFyZ3NbMF0gaW5zdGFuY2VvZiAoPGFueT5odHRwcykuU2VydmVyKSB7XHJcbiAgICAgICAgICAgIGNvbmZpZy5zZXJ2ZXIgPSBhcmdzWzBdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIGNvbmZpZy5wb3J0ID0gYXJnc1swXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBjb25maWcuaG9zdCA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1sxXSA9PT0gJ251bWJlcicpXHJcbiAgICAgICAgICAgICAgICBjb25maWcucG9ydCA9IGFyZ3NbMV07XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjb25maWcsIGFyZ3NbMF0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbmZpZy5zZXJ2ZXIpIHtcclxuICAgICAgICAgICAgY29uZmlnLmhvc3QgPSB1bmRlZmluZWQ7ICAgIC8v5b+F6aG75riF6Zmk77yM5ZCm5YiZV1PlhoXpg6jkvJrlj6blpJbliJvlu7rkuIDkuKpodHRwIHNlcnZlclxyXG4gICAgICAgICAgICBjb25maWcucG9ydCA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMud3MgPSBuZXcgV1MuU2VydmVyKGNvbmZpZyk7XHJcbiAgICAgICAgdGhpcy53cy5vbignZXJyb3InLCB0aGlzLmVtaXQuYmluZCh0aGlzLCAnZXJyb3InKSk7XHJcbiAgICAgICAgdGhpcy53cy5vbmNlKCdsaXN0ZW5pbmcnLCB0aGlzLmVtaXQuYmluZCh0aGlzLCAnbGlzdGVuaW5nJykpO1xyXG4gICAgICAgICg8YW55PnRoaXMud3MpLl9zZXJ2ZXIub25jZSgnY2xvc2UnLCB0aGlzLmVtaXQuYmluZCh0aGlzLCAnY2xvc2UnKSk7ICAvL3dz5YaF6YOo5Lya5oqK5Yib5bu65oiW57uR5a6a55qEaHR0cCBzZXJ2ZXIg5L+d5a2Y5YiwX3NlcnZlcuS4rVxyXG4gICAgICAgIHRoaXMud3Mub24oJ2Nvbm5lY3Rpb24nLCAoY2xpZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBTb2NrZXQoY2xpZW50KTtcclxuICAgICAgICAgICAgdGhpcy5jbGllbnRzLnNldChzb2NrZXQuaWQsIHNvY2tldCk7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGlvbicsIHNvY2tldCk7XHJcblxyXG4gICAgICAgICAgICBzb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnRzLmRlbGV0ZShzb2NrZXQuaWQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIpOaWreaYr+WQpuaOpeWPl+aWsOeahOi/nuaOpeOAgiAgICBcclxuICAgICAqIOi/lOWbnnRydWXooajnpLrmjqXlj5fvvIzov5Tlm55mYWxzZeihqOekuuaLkue7neOAguS5n+WPr+S7pei/lOWbnuS4gOS4quWvueixoe+8jOaPkOS+m+abtOWkmuS/oeaBr+OAgiAgXHJcbiAgICAgKiAgXHJcbiAgICAgKiDov5Tlm57lr7nosaHvvJogICAgXHJcbiAgICAgKiAgICAgIHJlcyB7Qm9vbGVhbn0gV2hldGhlciBvciBub3QgdG8gYWNjZXB0IHRoZSBoYW5kc2hha2UuICAgXHJcbiAgICAgKiAgICAgIGNvZGUge051bWJlcn0gV2hlbiByZXN1bHQgaXMgZmFsc2UgdGhpcyBmaWVsZCBkZXRlcm1pbmVzIHRoZSBIVFRQIGVycm9yIHN0YXR1cyBjb2RlIHRvIGJlIHNlbnQgdG8gdGhlIGNsaWVudC4gICBcclxuICAgICAqICAgICAgbmFtZSB7U3RyaW5nfSBXaGVuIHJlc3VsdCBpcyBmYWxzZSB0aGlzIGZpZWxkIGRldGVybWluZXMgdGhlIEhUVFAgcmVhc29uIHBocmFzZS4gICBcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG9yaWdpbiBUaGUgdmFsdWUgaW4gdGhlIE9yaWdpbiBoZWFkZXIgaW5kaWNhdGVkIGJ5IHRoZSBjbGllbnQuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNlY3VyZSAndHJ1ZScgaWYgcmVxLmNvbm5lY3Rpb24uYXV0aG9yaXplZCBvciByZXEuY29ubmVjdGlvbi5lbmNyeXB0ZWQgaXMgc2V0LlxyXG4gICAgICogQHBhcmFtIHtodHRwLkluY29taW5nTWVzc2FnZX0gcmVxIFRoZSBjbGllbnQgSFRUUCBHRVQgcmVxdWVzdC5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4gfCB7IHJlczogYm9vbGVhbiwgY29kZT86IG51bWJlciwgbWVzc2FnZT86IHN0cmluZyB9Pn0gXHJcbiAgICAgKiBAbWVtYmVyb2YgU2VydmVyXHJcbiAgICAgKi9cclxuICAgIHZlcmlmeUNsaWVudChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCBvcmlnaW46IHN0cmluZywgc2VjdXJlOiBib29sZWFuKTogUHJvbWlzZTxib29sZWFuIHwgeyByZXM6IGJvb2xlYW4sIGNvZGU/OiBudW1iZXIsIG1lc3NhZ2U/OiBzdHJpbmcgfT4ge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlhbPpl63mnI3liqHlmajvvIzlubbmlq3lvIDmiYDmnInnmoTlrqLmiLfnq6/ov57mjqVcclxuICAgICAqIFxyXG4gICAgICogQHJldHVybnMge3ZvaWR9IFxyXG4gICAgICogQG1lbWJlcm9mIFNlcnZlclxyXG4gICAgICovXHJcbiAgICBjbG9zZSgpIHtcclxuICAgICAgICBjb25zdCBzZXJ2ZXIgPSAoPGFueT50aGlzLndzKS5fc2VydmVyO1xyXG4gICAgICAgIHRoaXMud3MuY2xvc2UoKTtcclxuICAgICAgICBzZXJ2ZXIuY2xvc2UoKTsgICAgIC8vd3PkuI3kvJrlkKfnu5HlrprnmoRzZXJ2ZXLlhbPmjonvvIzmiYDku6Xov5nph4zlho3mrKHlhbPpl63kuIDkuItcclxuICAgIH1cclxuXHJcbiAgICBvbihldmVudDogJ2Vycm9yJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmnI3liqHlmajlvIDlp4vnm5HlkKxcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdsaXN0ZW5pbmcnLCBjYjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T5pyJ5paw55qE5a6i5oi356uv5LiO5pyN5Yqh5Zmo5bu656uL6LW36L+e5o6lXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnY29ubmVjdGlvbicsIGNiOiAoc29ja2V0OiBTb2NrZXQpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbihldmVudDogJ2Nsb3NlJywgY2I6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBvbmNlKGV2ZW50OiAnZXJyb3InLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+acjeWKoeWZqOW8gOWni+ebkeWQrFxyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnbGlzdGVuaW5nJywgY2I6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+acieaWsOeahOWuouaIt+err+S4juacjeWKoeWZqOW7uueri+i1t+i/nuaOpVxyXG4gICAgICovXHJcbiAgICBvbmNlKGV2ZW50OiAnY29ubmVjdGlvbicsIGNiOiAoc29ja2V0OiBTb2NrZXQpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiAnY2xvc2UnLCBjYjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uY2UoZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufSJdfQ==
