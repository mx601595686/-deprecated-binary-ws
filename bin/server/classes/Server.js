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
            maxPayload: configs.maxPayload == null || configs.maxPayload <= 0 ? undefined : configs.maxPayload + 4,
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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eUIsRUFBRSxNQUFjLEVBQUUsTUFBZTtRQUM3RSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsbUJBQW1CO0lBQzNDLENBQUM7SUFZRCxFQUFFLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2hDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQU1ELElBQUksQ0FBQyxLQUFhLEVBQUUsUUFBa0I7UUFDbEMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDNUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0NBQ0o7QUFoR0Qsd0JBZ0dDIiwiZmlsZSI6InNlcnZlci9jbGFzc2VzL1NlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFdTIGZyb20gJ3dzJztcclxuaW1wb3J0ICogYXMgRW1pdHRlciBmcm9tICdjb21wb25lbnQtZW1pdHRlcic7XHJcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XHJcbmltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcclxuaW1wb3J0IHsgVVJMIH0gZnJvbSAndXJsJztcclxuXHJcbmltcG9ydCB7IFNvY2tldCB9IGZyb20gJy4vU29ja2V0JztcclxuaW1wb3J0IHsgQmFzZVNvY2tldENvbmZpZyB9IGZyb20gJy4uLy4uL0Jhc2VTb2NrZXQvaW50ZXJmYWNlcy9CYXNlU29ja2V0Q29uZmlnJztcclxuXHJcbmV4cG9ydCBjbGFzcyBTZXJ2ZXIgZXh0ZW5kcyBFbWl0dGVyIHtcclxuXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9odHRwOiBodHRwLlNlcnZlciB8IGh0dHBzLlNlcnZlcjtcclxuXHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IF93czogV1MuU2VydmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5L+d5a2Y5omA5pyJ5a6i5oi356uv6L+e5o6l44CCa2V55pivc29ja2V0LmlkXHJcbiAgICAgKi9cclxuICAgIHJlYWRvbmx5IGNsaWVudHM6IE1hcDxudW1iZXIsIFNvY2tldD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7piaW5hcnktd3MgU2VydmVy44CCXHJcbiAgICAgKiBAcGFyYW0gc2VydmVyIOimgee7keWumueahGh0dHDmnI3liqHlmahcclxuICAgICAqIEBwYXJhbSBjb25maWdzIOaOpeWPo+mFjee9rlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihzZXJ2ZXI6IGh0dHAuU2VydmVyIHwgaHR0cHMuU2VydmVyLCBjb25maWdzOiBCYXNlU29ja2V0Q29uZmlnKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgdGhpcy5faHR0cCA9IHNlcnZlcjtcclxuICAgICAgICB0aGlzLl9odHRwLm9uY2UoJ2Nsb3NlJywgdGhpcy5lbWl0LmJpbmQodGhpcywgJ2Nsb3NlJykpO1xyXG5cclxuICAgICAgICB0aGlzLl93cyA9IG5ldyBXUy5TZXJ2ZXIoe1xyXG4gICAgICAgICAgICBzZXJ2ZXIsXHJcbiAgICAgICAgICAgIG1heFBheWxvYWQ6IGNvbmZpZ3MubWF4UGF5bG9hZCA9PSBudWxsIHx8IGNvbmZpZ3MubWF4UGF5bG9hZCA8PSAwID8gdW5kZWZpbmVkIDogY29uZmlncy5tYXhQYXlsb2FkICsgNCwgLy/lpJrliqA05piv5Zug5Li6dGl0bGXplb/luqbov5jkvJrljaDkuIDpg6jliIbmjqfku7ZcclxuICAgICAgICAgICAgcGF0aDogY29uZmlncy51cmwgJiYgKG5ldyBVUkwoY29uZmlncy51cmwpKS5wYXRobmFtZSxcclxuICAgICAgICAgICAgdmVyaWZ5Q2xpZW50OiAoaW5mbywgY2IpID0+IHsgICAvL+i/nuaOpemqjOivgVxyXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJpZnlDbGllbnQoaW5mby5yZXEsIGluZm8ub3JpZ2luLCBpbmZvLnNlY3VyZSlcclxuICAgICAgICAgICAgICAgICAgICAudGhlbigocmVzdWx0ID0+IHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IGNiKHJlc3VsdCkgOiBjYihyZXN1bHQucmVzLCByZXN1bHQuY29kZSwgcmVzdWx0Lm1lc3NhZ2UpKSlcclxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycikgPT4geyBjYihmYWxzZSk7IHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpOyB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLl93cy5vbignZXJyb3InLCB0aGlzLmVtaXQuYmluZCh0aGlzLCAnZXJyb3InKSk7XHJcbiAgICAgICAgdGhpcy5fd3Mub25jZSgnbGlzdGVuaW5nJywgdGhpcy5lbWl0LmJpbmQodGhpcywgJ2xpc3RlbmluZycpKTtcclxuXHJcbiAgICAgICAgdGhpcy5fd3Mub24oJ2Nvbm5lY3Rpb24nLCBjbGllbnQgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgU29ja2V0KGNvbmZpZ3MsIGNsaWVudCk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xpZW50cy5zZXQoc29ja2V0LmlkLCBzb2NrZXQpO1xyXG5cclxuICAgICAgICAgICAgc29ja2V0Lm9uY2UoJ2Nsb3NlJywgKCkgPT4gdGhpcy5jbGllbnRzLmRlbGV0ZShzb2NrZXQuaWQpKTtcclxuICAgICAgICAgICAgc29ja2V0Lm9uY2UoJ2Vycm9yJywgKCkgPT4gc29ja2V0LmNsb3NlKCkpOyAvL+aOpeWPo+WmguaenOWHuueOsOW8guW4uOWImeWFs+mXrVxyXG5cclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjb25uZWN0aW9uJywgc29ja2V0KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIpOaWreaYr+WQpuaOpeWPl+aWsOeahOi/nuaOpeOAgiAgICBcclxuICAgICAqIOi/lOWbnnRydWXooajnpLrmjqXlj5fvvIzov5Tlm55mYWxzZeihqOekuuaLkue7neOAguS5n+WPr+S7pei/lOWbnuS4gOS4quWvueixoe+8jOaPkOS+m+abtOWkmuS/oeaBr+OAgiAgXHJcbiAgICAgKiAgXHJcbiAgICAgKiDov5Tlm57lr7nosaHvvJogICAgXHJcbiAgICAgKiAgICAgIHJlcyB7Qm9vbGVhbn0gV2hldGhlciBvciBub3QgdG8gYWNjZXB0IHRoZSBoYW5kc2hha2UuICAgXHJcbiAgICAgKiAgICAgIGNvZGUge051bWJlcn0gV2hlbiByZXN1bHQgaXMgZmFsc2UgdGhpcyBmaWVsZCBkZXRlcm1pbmVzIHRoZSBIVFRQIGVycm9yIHN0YXR1cyBjb2RlIHRvIGJlIHNlbnQgdG8gdGhlIGNsaWVudC4gICBcclxuICAgICAqICAgICAgbmFtZSB7U3RyaW5nfSBXaGVuIHJlc3VsdCBpcyBmYWxzZSB0aGlzIGZpZWxkIGRldGVybWluZXMgdGhlIEhUVFAgcmVhc29uIHBocmFzZS4gICBcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtodHRwLkluY29taW5nTWVzc2FnZX0gcmVxIFRoZSBjbGllbnQgSFRUUCBHRVQgcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvcmlnaW4gVGhlIHZhbHVlIGluIHRoZSBPcmlnaW4gaGVhZGVyIGluZGljYXRlZCBieSB0aGUgY2xpZW50LlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZWN1cmUgJ3RydWUnIGlmIHJlcS5jb25uZWN0aW9uLmF1dGhvcml6ZWQgb3IgcmVxLmNvbm5lY3Rpb24uZW5jcnlwdGVkIGlzIHNldC5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4gfCB7IHJlczogYm9vbGVhbiwgY29kZT86IG51bWJlciwgbWVzc2FnZT86IHN0cmluZyB9Pn0gXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCB2ZXJpZnlDbGllbnQocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgb3JpZ2luOiBzdHJpbmcsIHNlY3VyZTogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbiB8IHsgcmVzOiBib29sZWFuLCBjb2RlPzogbnVtYmVyLCBtZXNzYWdlPzogc3RyaW5nIH0+IHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5YWz6Zet5pyN5Yqh5Zmo77yM5bm25pat5byA5omA5pyJ55qE5a6i5oi356uv6L+e5o6l44CC77yI5rOo5oSP6L+Z5Liq5Lya5bCG57uR5a6a55qEaHR0cCBzZXJ2ZXLkuZ/lhbPkuobvvIlcclxuICAgICAqL1xyXG4gICAgY2xvc2UoKSB7XHJcbiAgICAgICAgdGhpcy5fd3MuY2xvc2UoKTtcclxuICAgICAgICB0aGlzLl9odHRwLmNsb3NlKCk7IC8vX3dz5LiN5Lya5oqK57uR5a6a55qEc2VydmVy5YWz5o6JXHJcbiAgICB9XHJcblxyXG4gICAgb24oZXZlbnQ6ICdlcnJvcicsIGxpc3RlbmVyOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIC8qKlxyXG4gICAgICog5b2T5pyN5Yqh5Zmo5byA5aeL55uR5ZCsXHJcbiAgICAgKi9cclxuICAgIG9uKGV2ZW50OiAnbGlzdGVuaW5nJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+acieaWsOeahOWuouaIt+err+S4juacjeWKoeWZqOW7uueri+i1t+i/nuaOpVxyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ2Nvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKHNvY2tldDogU29ja2V0KSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb24oZXZlbnQ6ICdjbG9zZScsIGxpc3RlbmVyOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBGdW5jdGlvbik6IHRoaXMge1xyXG4gICAgICAgIHN1cGVyLm9uKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgb25jZShldmVudDogJ2Vycm9yJywgbGlzdGVuZXI6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogJ2xpc3RlbmluZycsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogJ2Nvbm5lY3Rpb24nLCBsaXN0ZW5lcjogKHNvY2tldDogU29ja2V0KSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogJ2Nsb3NlJywgbGlzdGVuZXI6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgb25jZShldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzIHtcclxuICAgICAgICBzdXBlci5vbmNlKGV2ZW50LCBsaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn0iXX0=
