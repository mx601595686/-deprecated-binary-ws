import expect = require('expect.js');
import * as BWS from '../..';
import * as http from 'http';

//测试时会用到8080端口，请确保端口不会被占用

describe('测试Server', function () {

    describe('测试启动与关闭', function () {
        let server: BWS.Server;

        it('测试listening事件', function (done) {
            const hs = http.createServer((req, res) => {
                res.end('hello');
            });

            hs.listen(8080);

            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        it('测试连接服务器', function (done) {
            server.on('connection', () => done());
            const socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
        });

        it('测试close事件', function (done) {
            server.on('close', done);
            server.close();
        });
    });

    describe('测试verifyClient', function () {
        class TestServer extends BWS.Server {
            async verifyClient(req: http.IncomingMessage, origin: string, secure: boolean) {
                if (req.headers.testheader === '123')
                    return true;
                else
                    return { res: false, name: 'Message: testheader is undefined' };
            }
        }

        let server: TestServer;

        before(function (done) {
            const hs = http.createServer();
            hs.listen(8080);
            server = new TestServer(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        it('带指定header', function (done) {
            const client = new BWS.ServerSocket({ url: 'ws://localhost:8080', headers: { testHeader: '123' } });
            client.on('open', done);
        });

        it('不带指定header', function (done) {
            const client = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            client.on('open', () => done(new Error('逻辑出现错误')));
            client.on('error', (err) => done());
        });
    });

    describe('检查server.clients', function () {

        let server: BWS.Server;
        const socket: BWS.ServerSocket[] = [];

        before(function (done) {
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        it('新建连接1', function name(done) {
            let s = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    done();
                }, 1000);
            });
            socket.push(s);
        });

        it('新建连接2', function name(done) {
            let s = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(2);
                    done();
                }, 1000);
            });
            socket.push(s);
        });

        it('新建连接3', function name(done) {
            let s = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(3);
                    done();
                }, 1000);
            });
            socket.push(s);
        });

        it('断开连接1', function (done) {
            socket[0].on('close', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(2);
                    done();
                }, 1000);
            });
            socket[0].close();
        });

        it('断开连接2', function (done) {
            socket[1].on('close', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    done();
                }, 1000);
            });
            socket[1].close();
        });

        it('断开连接3', function (done) {
            socket[2].on('close', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(0);
                    done();
                }, 1000);
            });
            socket[2].close();
        });
    });

    describe('测试关闭server自动断开所有连接', function () {
        let server: BWS.Server;
        let socket: BWS.ServerSocket;

        before(function (done) {
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        beforeEach(function name(done) {
            socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    done();
                }, 1000);
            });
        });

        it('关闭server', function (done) {
            let socketClose = false;
            socket.on('close', () => socketClose = true);
            server.on('close', () => {
                setTimeout(() => {
                    expect(socketClose).to.be.ok();
                    expect(server.clients.size).to.be(0);
                    done();
                }, 1000);
            });
            server.close();
        });
    });

    describe('测试server端socket出现错误，自动断开', function () {
        let server: BWS.Server;
        let socket: BWS.ServerSocket;

        before(function (done) {
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        beforeEach(function name(done) {
            socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    done();
                }, 1000);
            });
        });

        it('触发error事件，断开连接', function (done) {
            const ss = server.clients.values().next().value;
            ss.once('close', () => done());
            ss.emit('error', new Error());
        });
    });
});


