"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WS = require("ws");
const Emitter = require("component-emitter");
const url_1 = require("url");
const Socket_1 = require("./Socket");
class Server extends Emitter {
    /**
     * 创建binary-ws Server。
     * @param server 要绑定的http服务器
     * @param configs 接口配置
     */
    constructor(server, configs) {
        super();
        /**
         * 保存所有客户端连接。key是socket.id
         */
        this.clients = new Map();
        this._http = server;
        this._http.once('close', this.emit.bind(this, 'close'));
        this._ws = new WS.Server({
            server,
            maxPayload: configs.maxPayload == null || configs.maxPayload <= 0 ? undefined : configs.maxPayload + 1024,
            path: configs.url && (new url_1.URL(configs.url)).pathname,
            verifyClient: (info, cb) => {
                this.verifyClient(info.req, info.origin, info.secure)
                    .then((result => typeof result === 'boolean' ? cb(result) : cb(result.res, result.code, result.message)))
                    .catch((err) => { cb(false); this.emit('error', err); });
            }
        });
        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws.once('listening', this.emit.bind(this, 'listening'));
        this._ws.on('connection', client => {
            const socket = new Socket_1.Socket(configs, client);
            this.clients.set(socket.id, socket);
            socket.once('close', () => this.clients.delete(socket.id));
            socket.once('error', () => socket.close()); //接口如果出现异常则关闭
            this.emit('connection', socket);
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
     * @param {http.IncomingMessage} req The client HTTP GET request.
     * @param {string} origin The value in the Origin header indicated by the client.
     * @param {boolean} secure 'true' if req.connection.authorized or req.connection.encrypted is set.
     * @returns {Promise<boolean | { res: boolean, code?: number, message?: string }>}
     */
    verifyClient(req, origin, secure) {
        return Promise.resolve(true);
    }
    /**
     * 关闭服务器，并断开所有的客户端连接。（注意这个会将绑定的http server也关了）
     */
    close() {
        this._ws.close();
        this._http.close(); //_ws不会把绑定的server关掉
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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eUIsRUFBRSxNQUFjLEVBQUUsTUFBZTtRQUM3RSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsbUJBQW1CO0lBQzNDLENBQUM7SUFZRCxFQUFFLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2hDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQU1ELElBQUksQ0FBQyxLQUFhLEVBQUUsUUFBa0I7UUFDbEMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDNUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0NBQ0o7QUFoR0Qsd0JBZ0dDIiwiZmlsZSI6InNlcnZlci9jbGFzc2VzL1NlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFdTIGZyb20gJ3dzJztcclxuaW1wb3J0ICogYXMgRW1pdHRlciBmcm9tICdjb21wb25lbnQtZW1pdHRlcic7XHJcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XHJcbmltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcclxuaW1wb3J0IHsgVVJMIH0gZnJvbSAndXJsJztcclxuXHJcbmltcG9ydCB7IFNvY2tldCB9IGZyb20gJy4vU29ja2V0JztcclxuaW1wb3J0IHsgQmFzZVNvY2tldENvbmZpZyB9IGZyb20gJy4uLy4uL0Jhc2VTb2NrZXQvaW50ZXJmYWNlcy9CYXNlU29ja2V0Q29uZmlnJztcclxuXHJcbmV4cG9ydCBjbGFzcyBTZXJ2ZXIgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9odHRwOiBodHRwLlNlcnZlciB8IGh0dHBzLlNlcnZlcjtcclxuXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF93czogV1MuU2VydmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y5omA5pyJ5a6i5oi356uv6L+e5o6l44CCa2V55pivc29ja2V0LmlkXHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IGNsaWVudHM6IE1hcDxudW1iZXIsIFNvY2tldD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7piaW5hcnktd3MgU2VydmVy44CCXHJcbiAgICAgKiBAcGFyYW0gc2VydmVyIOimgee7keWumueahGh0dHDmnI3liqHlmahcclxuICAgICAqIEBwYXJhbSBjb25maWdzIOaOpeWPo+mFjee9rlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihzZXJ2ZXI6IGh0dHAuU2VydmVyIHwgaHR0cHMuU2VydmVyLCBjb25maWdzOiBCYXNlU29ja2V0Q29uZmlnKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faHR0cCA9IHNlcnZlcjtcclxuICAgICAgICB0aGlzLl9odHRwLm9uY2UoJ2Nsb3NlJywgdGhpcy5lbWl0LmJpbmQodGhpcywgJ2Nsb3NlJykpO1xyXG5cclxuICAgICAgICB0aGlzLl93cyA9IG5ldyBXUy5TZXJ2ZXIoe1xyXG4gICAgICAgICAgICBzZXJ2ZXIsXHJcbiAgICAgICAgICAgIG1heFBheWxvYWQ6IGNvbmZpZ3MubWF4UGF5bG9hZCA9PSBudWxsIHx8IGNvbmZpZ3MubWF4UGF5bG9hZCA8PSAwID8gdW5kZWZpbmVkIDogY29uZmlncy5tYXhQYXlsb2FkICsgMTAyNCwgLy/lpJrliqAxa2LmmK/kuLrlhoXpg6jkv6Hmga/kuIDpg6jliIbnqbrpl7RcclxuICAgICAgICAgICAgcGF0aDogY29uZmlncy51cmwgJiYgKG5ldyBVUkwoY29uZmlncy51cmwpKS5wYXRobmFtZSxcclxuICAgICAgICAgICAgdmVyaWZ5Q2xpZW50OiAoaW5mbywgY2IpID0+IHsgICAvL+i/nuaOpemqjOivgVxyXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJpZnlDbGllbnQoaW5mby5yZXEsIGluZm8ub3JpZ2luLCBpbmZvLnNlY3VyZSlcclxuICAgICAgICAgICAgICAgICAgICAudGhlbigocmVzdWx0ID0+IHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IGNiKHJlc3VsdCkgOiBjYihyZXN1bHQucmVzLCByZXN1bHQuY29kZSwgcmVzdWx0Lm1lc3NhZ2UpKSlcclxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycikgPT4geyBjYihmYWxzZSk7IHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3dzLm9uKCdlcnJvcicsIHRoaXMuZW1pdC5iaW5kKHRoaXMsICdlcnJvcicpKTtcclxuICAgICAgICB0aGlzLl93cy5vbmNlKCdsaXN0ZW5pbmcnLCB0aGlzLmVtaXQuYmluZCh0aGlzLCAnbGlzdGVuaW5nJykpO1xyXG5cclxuICAgICAgICB0aGlzLl93cy5vbignY29ubmVjdGlvbicsIGNsaWVudCA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBTb2NrZXQoY29uZmlncywgY2xpZW50KTtcclxuICAgICAgICAgICAgdGhpcy5jbGllbnRzLnNldChzb2NrZXQuaWQsIHNvY2tldCk7XHJcblxyXG4gICAgICAgICAgICBzb2NrZXQub25jZSgnY2xvc2UnLCAoKSA9PiB0aGlzLmNsaWVudHMuZGVsZXRlKHNvY2tldC5pZCkpO1xyXG4gICAgICAgICAgICBzb2NrZXQub25jZSgnZXJyb3InLCAoKSA9PiBzb2NrZXQuY2xvc2UoKSk7IC8v5o6l5Y+j5aaC5p6c5Ye6546w5byC5bi45YiZ5YWz6ZetXHJcblxyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3Rpb24nLCBzb2NrZXQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yik5pat5piv5ZCm5o6l5Y+X5paw55qE6L+e5o6l44CCICAgIFxyXG4gICAgICog6L+U5ZuedHJ1ZeihqOekuuaOpeWPl++8jOi/lOWbnmZhbHNl6KGo56S65ouS57ud44CC5Lmf5Y+v5Lul6L+U5Zue5LiA5Liq5a+56LGh77yM5o+Q5L6b5pu05aSa5L+h5oGv44CCICBcclxuICAgICAqICBcclxuICAgICAqIOi/lOWbnuWvueixoe+8miAgICBcclxuICAgICAqICAgICAgcmVzIHtCb29sZWFufSBXaGV0aGVyIG9yIG5vdCB0byBhY2NlcHQgdGhlIGhhbmRzaGFrZS4gICBcclxuICAgICAqICAgICAgY29kZSB7TnVtYmVyfSBXaGVuIHJlc3VsdCBpcyBmYWxzZSB0aGlzIGZpZWxkIGRldGVybWluZXMgdGhlIEhUVFAgZXJyb3Igc3RhdHVzIGNvZGUgdG8gYmUgc2VudCB0byB0aGUgY2xpZW50LiAgIFxyXG4gICAgICogICAgICBuYW1lIHtTdHJpbmd9IFdoZW4gcmVzdWx0IGlzIGZhbHNlIHRoaXMgZmllbGQgZGV0ZXJtaW5lcyB0aGUgSFRUUCByZWFzb24gcGhyYXNlLiAgIFxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge2h0dHAuSW5jb21pbmdNZXNzYWdlfSByZXEgVGhlIGNsaWVudCBIVFRQIEdFVCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG9yaWdpbiBUaGUgdmFsdWUgaW4gdGhlIE9yaWdpbiBoZWFkZXIgaW5kaWNhdGVkIGJ5IHRoZSBjbGllbnQuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNlY3VyZSAndHJ1ZScgaWYgcmVxLmNvbm5lY3Rpb24uYXV0aG9yaXplZCBvciByZXEuY29ubmVjdGlvbi5lbmNyeXB0ZWQgaXMgc2V0LlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbiB8IHsgcmVzOiBib29sZWFuLCBjb2RlPzogbnVtYmVyLCBtZXNzYWdlPzogc3RyaW5nIH0+fSBcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIHZlcmlmeUNsaWVudChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCBvcmlnaW46IHN0cmluZywgc2VjdXJlOiBib29sZWFuKTogUHJvbWlzZTxib29sZWFuIHwgeyByZXM6IGJvb2xlYW4sIGNvZGU/OiBudW1iZXIsIG1lc3NhZ2U/OiBzdHJpbmcgfT4ge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlhbPpl63mnI3liqHlmajvvIzlubbmlq3lvIDmiYDmnInnmoTlrqLmiLfnq6/ov57mjqXjgILvvIjms6jmhI/ov5nkuKrkvJrlsIbnu5HlrprnmoRodHRwIHNlcnZlcuS5n+WFs+S6hu+8iVxyXG4gICAgICovXHJcbiAgICBjbG9zZSgpIHtcclxuICAgICAgICB0aGlzLl93cy5jbG9zZSgpO1xyXG4gICAgICAgIHRoaXMuX2h0dHAuY2xvc2UoKTsgLy9fd3PkuI3kvJrmiornu5HlrprnmoRzZXJ2ZXLlhbPmjolcclxuICAgIH1cclxuXHJcbiAgICBvbihldmVudDogJ2Vycm9yJywgbGlzdGVuZXI6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmnI3liqHlmajlvIDlp4vnm5HlkKxcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdsaXN0ZW5pbmcnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T5pyJ5paw55qE5a6i5oi356uv5LiO5pyN5Yqh5Zmo5bu656uL6LW36L+e5o6lXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnY29ubmVjdGlvbicsIGxpc3RlbmVyOiAoc29ja2V0OiBTb2NrZXQpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbihldmVudDogJ2Nsb3NlJywgbGlzdGVuZXI6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBvbmNlKGV2ZW50OiAnZXJyb3InLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiAnbGlzdGVuaW5nJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiAnY29ubmVjdGlvbicsIGxpc3RlbmVyOiAoc29ja2V0OiBTb2NrZXQpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiAnY2xvc2UnLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbmNlKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uY2UoZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufSJdfQ==
