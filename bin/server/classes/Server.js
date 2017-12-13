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
        this._ws.on('connection', (client, req) => {
            const socket = new Socket_1.Socket(configs, client, req);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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OztPQWFHO0lBQ08sWUFBWSxDQUFDLEdBQXlCLEVBQUUsTUFBYyxFQUFFLE1BQWU7UUFDN0UsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSztRQUNELElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQjtJQUMzQyxDQUFDO0lBWUQsRUFBRSxDQUFDLEtBQWEsRUFBRSxRQUFrQjtRQUNoQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFNRCxJQUFJLENBQUMsS0FBYSxFQUFFLFFBQWtCO1FBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBQztDQUNKO0FBaEdELHdCQWdHQyIsImZpbGUiOiJzZXJ2ZXIvY2xhc3Nlcy9TZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBXUyBmcm9tICd3cyc7XHJcbmltcG9ydCAqIGFzIEVtaXR0ZXIgZnJvbSAnY29tcG9uZW50LWVtaXR0ZXInO1xyXG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xyXG5pbXBvcnQgKiBhcyBodHRwcyBmcm9tICdodHRwcyc7XHJcbmltcG9ydCB7IFVSTCB9IGZyb20gJ3VybCc7XHJcblxyXG5pbXBvcnQgeyBTb2NrZXQgfSBmcm9tICcuL1NvY2tldCc7XHJcbmltcG9ydCB7IEJhc2VTb2NrZXRDb25maWcgfSBmcm9tICcuLi8uLi9CYXNlU29ja2V0L2ludGVyZmFjZXMvQmFzZVNvY2tldENvbmZpZyc7XHJcblxyXG5leHBvcnQgY2xhc3MgU2VydmVyIGV4dGVuZHMgRW1pdHRlciB7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfaHR0cDogaHR0cC5TZXJ2ZXIgfCBodHRwcy5TZXJ2ZXI7XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBfd3M6IFdTLlNlcnZlcjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOS/neWtmOaJgOacieWuouaIt+err+i/nuaOpeOAgmtleeaYr3NvY2tldC5pZFxyXG4gICAgICovXHJcbiAgICByZWFkb25seSBjbGllbnRzOiBNYXA8bnVtYmVyLCBTb2NrZXQ+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yib5bu6YmluYXJ5LXdzIFNlcnZlcuOAglxyXG4gICAgICogQHBhcmFtIHNlcnZlciDopoHnu5HlrprnmoRodHRw5pyN5Yqh5ZmoXHJcbiAgICAgKiBAcGFyYW0gY29uZmlncyDmjqXlj6PphY3nva5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3Ioc2VydmVyOiBodHRwLlNlcnZlciB8IGh0dHBzLlNlcnZlciwgY29uZmlnczogQmFzZVNvY2tldENvbmZpZykge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIHRoaXMuX2h0dHAgPSBzZXJ2ZXI7XHJcbiAgICAgICAgdGhpcy5faHR0cC5vbmNlKCdjbG9zZScsIHRoaXMuZW1pdC5iaW5kKHRoaXMsICdjbG9zZScpKTtcclxuXHJcbiAgICAgICAgdGhpcy5fd3MgPSBuZXcgV1MuU2VydmVyKHtcclxuICAgICAgICAgICAgc2VydmVyLFxyXG4gICAgICAgICAgICBtYXhQYXlsb2FkOiBjb25maWdzLm1heFBheWxvYWQgPT0gbnVsbCB8fCBjb25maWdzLm1heFBheWxvYWQgPD0gMCA/IHVuZGVmaW5lZCA6IGNvbmZpZ3MubWF4UGF5bG9hZCArIDQsIC8v5aSa5YqgNOaYr+WboOS4unRpdGxl6ZW/5bqm6L+Y5Lya5Y2g5LiA6YOo5YiG5o6n5Lu2XHJcbiAgICAgICAgICAgIHBhdGg6IGNvbmZpZ3MudXJsICYmIChuZXcgVVJMKGNvbmZpZ3MudXJsKSkucGF0aG5hbWUsXHJcbiAgICAgICAgICAgIHZlcmlmeUNsaWVudDogKGluZm8sIGNiKSA9PiB7ICAgLy/ov57mjqXpqozor4FcclxuICAgICAgICAgICAgICAgIHRoaXMudmVyaWZ5Q2xpZW50KGluZm8ucmVxLCBpbmZvLm9yaWdpbiwgaW5mby5zZWN1cmUpXHJcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKHJlc3VsdCA9PiB0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicgPyBjYihyZXN1bHQpIDogY2IocmVzdWx0LnJlcywgcmVzdWx0LmNvZGUsIHJlc3VsdC5tZXNzYWdlKSkpXHJcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnIpID0+IHsgY2IoZmFsc2UpOyB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTsgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5fd3Mub24oJ2Vycm9yJywgdGhpcy5lbWl0LmJpbmQodGhpcywgJ2Vycm9yJykpO1xyXG4gICAgICAgIHRoaXMuX3dzLm9uY2UoJ2xpc3RlbmluZycsIHRoaXMuZW1pdC5iaW5kKHRoaXMsICdsaXN0ZW5pbmcnKSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3dzLm9uKCdjb25uZWN0aW9uJywgKGNsaWVudCwgcmVxKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNvY2tldCA9IG5ldyBTb2NrZXQoY29uZmlncywgY2xpZW50LCByZXEpO1xyXG4gICAgICAgICAgICB0aGlzLmNsaWVudHMuc2V0KHNvY2tldC5pZCwgc29ja2V0KTtcclxuXHJcbiAgICAgICAgICAgIHNvY2tldC5vbmNlKCdjbG9zZScsICgpID0+IHRoaXMuY2xpZW50cy5kZWxldGUoc29ja2V0LmlkKSk7XHJcbiAgICAgICAgICAgIHNvY2tldC5vbmNlKCdlcnJvcicsICgpID0+IHNvY2tldC5jbG9zZSgpKTsgLy/mjqXlj6PlpoLmnpzlh7rnjrDlvILluLjliJnlhbPpl61cclxuXHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGlvbicsIHNvY2tldCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliKTmlq3mmK/lkKbmjqXlj5fmlrDnmoTov57mjqXjgIIgICAgXHJcbiAgICAgKiDov5Tlm550cnVl6KGo56S65o6l5Y+X77yM6L+U5ZueZmFsc2XooajnpLrmi5Lnu53jgILkuZ/lj6/ku6Xov5Tlm57kuIDkuKrlr7nosaHvvIzmj5Dkvpvmm7TlpJrkv6Hmga/jgIIgIFxyXG4gICAgICogIFxyXG4gICAgICog6L+U5Zue5a+56LGh77yaICAgIFxyXG4gICAgICogICAgICByZXMge0Jvb2xlYW59IFdoZXRoZXIgb3Igbm90IHRvIGFjY2VwdCB0aGUgaGFuZHNoYWtlLiAgIFxyXG4gICAgICogICAgICBjb2RlIHtOdW1iZXJ9IFdoZW4gcmVzdWx0IGlzIGZhbHNlIHRoaXMgZmllbGQgZGV0ZXJtaW5lcyB0aGUgSFRUUCBlcnJvciBzdGF0dXMgY29kZSB0byBiZSBzZW50IHRvIHRoZSBjbGllbnQuICAgXHJcbiAgICAgKiAgICAgIG5hbWUge1N0cmluZ30gV2hlbiByZXN1bHQgaXMgZmFsc2UgdGhpcyBmaWVsZCBkZXRlcm1pbmVzIHRoZSBIVFRQIHJlYXNvbiBwaHJhc2UuICAgXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7aHR0cC5JbmNvbWluZ01lc3NhZ2V9IHJlcSBUaGUgY2xpZW50IEhUVFAgR0VUIHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gb3JpZ2luIFRoZSB2YWx1ZSBpbiB0aGUgT3JpZ2luIGhlYWRlciBpbmRpY2F0ZWQgYnkgdGhlIGNsaWVudC5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2VjdXJlICd0cnVlJyBpZiByZXEuY29ubmVjdGlvbi5hdXRob3JpemVkIG9yIHJlcS5jb25uZWN0aW9uLmVuY3J5cHRlZCBpcyBzZXQuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuIHwgeyByZXM6IGJvb2xlYW4sIGNvZGU/OiBudW1iZXIsIG1lc3NhZ2U/OiBzdHJpbmcgfT59IFxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgdmVyaWZ5Q2xpZW50KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIG9yaWdpbjogc3RyaW5nLCBzZWN1cmU6IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4gfCB7IHJlczogYm9vbGVhbiwgY29kZT86IG51bWJlciwgbWVzc2FnZT86IHN0cmluZyB9PiB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWFs+mXreacjeWKoeWZqO+8jOW5tuaWreW8gOaJgOacieeahOWuouaIt+err+i/nuaOpeOAgu+8iOazqOaEj+i/meS4quS8muWwhue7keWumueahGh0dHAgc2VydmVy5Lmf5YWz5LqG77yJXHJcbiAgICAgKi9cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMuX3dzLmNsb3NlKCk7XHJcbiAgICAgICAgdGhpcy5faHR0cC5jbG9zZSgpOyAvL193c+S4jeS8muaKiue7keWumueahHNlcnZlcuWFs+aOiVxyXG4gICAgfVxyXG5cclxuICAgIG9uKGV2ZW50OiAnZXJyb3InLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICAvKipcclxuICAgICAqIOW9k+acjeWKoeWZqOW8gOWni+ebkeWQrFxyXG4gICAgICovXHJcbiAgICBvbihldmVudDogJ2xpc3RlbmluZycsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpc1xyXG4gICAgLyoqXHJcbiAgICAgKiDlvZPmnInmlrDnmoTlrqLmiLfnq6/kuI7mnI3liqHlmajlu7rnq4votbfov57mjqVcclxuICAgICAqL1xyXG4gICAgb24oZXZlbnQ6ICdjb25uZWN0aW9uJywgbGlzdGVuZXI6IChzb2NrZXQ6IFNvY2tldCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uKGV2ZW50OiAnY2xvc2UnLCBsaXN0ZW5lcjogKGVycjogRXJyb3IpID0+IHZvaWQpOiB0aGlzXHJcbiAgICBvbihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRnVuY3Rpb24pOiB0aGlzIHtcclxuICAgICAgICBzdXBlci5vbihldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIG9uY2UoZXZlbnQ6ICdlcnJvcicsIGxpc3RlbmVyOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6ICdsaXN0ZW5pbmcnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6ICdjb25uZWN0aW9uJywgbGlzdGVuZXI6IChzb2NrZXQ6IFNvY2tldCkgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6ICdjbG9zZScsIGxpc3RlbmVyOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHRoaXNcclxuICAgIG9uY2UoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IEZ1bmN0aW9uKTogdGhpcyB7XHJcbiAgICAgICAgc3VwZXIub25jZShldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59Il19
