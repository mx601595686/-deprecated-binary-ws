import { Socket } from './../src/server/Socket';
import expect = require('expect.js');
import * as BWS from '../';
import * as http from 'http';

//测试时会用到8080和8888端口，请确保这些端口不会被占用

describe('测试Server', function () {

    describe('测试启动与关闭', function () {

        describe('无参数创建', function () {
            let server: BWS.Server;

            it('测试listening事件', function (done) {
                server = new BWS.Server();
                server.on('listening', done);
            });

            it('测试连接服务器', function (done) {
                server.on('connection', () => done());
                const socket = new BWS.Socket('ws://localhost:8080');
            });

            it('测试close事件', function (done) {
                server.on('close', done);
                server.close();
            });
        });

        describe('绑定http server方式', function () {
            let server: BWS.Server;

            it('测试listening事件', function (done) {
                const hs = http.createServer((req, res) => {
                    res.end('hello');
                });

                hs.listen(8888);

                server = new BWS.Server(hs);
                server.on('listening', done);
            });

            it('测试连接服务器', function (done) {
                server.on('connection', () => done());
                const socket = new BWS.Socket('ws://localhost:8888');
            });

            it('测试close事件', function (done) {
                server.on('close', done);
                server.close();
            });
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
            server = new TestServer();
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        it('带指定header', function (done) {
            const client = new BWS.Socket({ url: 'ws://localhost:8080', headers: { testHeader: '123' } });
            client.on('open', done);
        });

        it('不带指定header', function (done) {
            const client = new BWS.Socket('ws://localhost:8080');
            client.on('open', () => { throw new Error('逻辑出现错误') });
            client.on('error', (err) => done());
        });
    });

    describe('检查server.clients', function () {

        let server: BWS.Server;
        let socket: BWS.Socket;

        before(function (done) {
            server = new BWS.Server();
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        it('新建连接', function name(done) {
            socket = new BWS.Socket('ws://localhost:8080');
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).be(1);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
        });

        it('断开连接', function (done) {
            socket.on('close', function () {
                setTimeout(() => {
                    expect(server.clients.size).be(0);
                    done();
                }, 1000);
            });
            socket.close();
        });
    });
});

