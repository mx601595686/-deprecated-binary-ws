import { Socket } from './../src/server/Socket';
import expect = require('expect.js');
import * as BWS from '../';
import * as http from 'http';

//测试时会用到8000,8080,8880和8888端口，请确保这些端口不会被占用

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

        describe('指定port创建', function () {
            let server: BWS.Server;

            it('测试listening事件', function (done) {
                server = new BWS.Server(8000);
                server.on('listening', done);
            });

            it('测试连接服务器', function (done) {
                server.on('connection', () => done());
                const socket = new BWS.Socket('ws://localhost:8000');
            });

            it('测试close事件', function (done) {
                server.on('close', done);
                server.close();
            });
        });

        describe('指定host与port创建', function () {
            let server: BWS.Server;

            it('测试listening事件', function (done) {
                server = new BWS.Server('localhost', 8880);
                server.on('listening', done);
            });

            it('测试连接服务器', function (done) {
                server.on('connection', () => done());
                const socket = new BWS.Socket('ws://localhost:8880');
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

        describe('通过配置创建', function () {
            let server: BWS.Server;

            it('测试listening事件', function (done) {
                const hs = http.createServer((req, res) => {
                    res.end('hello');
                });

                hs.listen(8880);

                server = new BWS.Server({ port: 8080, host: 'localhost', server: hs });
                server.on('listening', done);
            });

            it('测试连接服务器', function (done) {
                server.on('connection', () => done());
                const socket = new BWS.Socket('ws://localhost:8880');
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
            client.on('open', () => done(new Error('逻辑出现错误')));
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
                    expect(server.clients.size).to.be(1);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
        });

        it('断开连接', function (done) {
            socket.on('close', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(0);
                    done();
                }, 1000);
            });
            socket.close();
        });
    });
});

describe.only('测试Server Socket', function () {
    let server: BWS.Server;

    let s_socket: BWS.Socket;    //服务器端对应的接口
    let c_socket: BWS.Socket;    //客户端接口

    before(function (done) {    // 打开服务器
        server = new BWS.Server();
        server.on('listening', done);
    });

    after(function (done) {
        server.on('close', done)
        server.close();
    });

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.Socket('ws://localhost:8080');
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            expect(server.clients.size).to.be(1);
            s_socket = server.clients.values().next().value;
            done();
        });
    });

    afterEach(function (done) {
        s_socket.on('close', () => {
            (<any>s_socket) = undefined;
            (<any>c_socket) = undefined;
            done();
        });
        c_socket.close();
    });

    it('检查socket的属性是否正确', function () {
        expect(s_socket.bufferedAmount).to.be(0);
        expect(c_socket.bufferedAmount).to.be(0);
        expect(s_socket.readyState).to.be(BWS.ReadyState.OPEN);
        expect(c_socket.readyState).to.be(BWS.ReadyState.OPEN);
        expect(s_socket.url).to.be('');
        expect(c_socket.url).to.be('ws://localhost:8080');
        expect(s_socket.platform).to.be('node');
        expect(c_socket.platform).to.be('node');
    });

    it('测试顺序收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            s_socket.on('message', (name, data) => {
                index++;
                switch (name) {
                    case '1':
                        expect(index).to.be(1);

                        expect(data).to.be.empty();
                        break;

                    case '2':
                        expect(index).to.be(2);

                        expect(data[0]).to.be(0);
                        expect(data[1]).to.be(1.1);
                        expect(data[2]).to.be('2');
                        expect(data[3]).to.be(true);
                        expect(data[4]).to.be(false);
                        expect(data[5]).to.be(null);
                        expect(data[6]).to.be(undefined);
                        expect(data[7]).to.be.eql({ a: 123 });
                        expect(data[8]).to.be.eql([1, 2, 3]);
                        expect(Buffer.from('123').equals(data[9])).to.be.ok();
                        break;

                    case '3':
                        expect(index).to.be(3);

                        expect(data).to.be.empty();
                        break;

                    case '4':
                        expect(index).to.be(4);

                        expect(data[0]).to.be(1);
                        expect(data[1]).to.be(2.1);
                        expect(data[2]).to.be('3');
                        expect(data[3]).to.be(false);
                        expect(data[4]).to.be(true);
                        expect(data[5]).to.be(undefined);
                        expect(data[6]).to.be(null);
                        expect(data[7]).to.be.eql({ a: 456 });
                        expect(data[8]).to.be.eql([4, 5, 6]);
                        expect(Buffer.from('789').equals(data[9])).to.be.ok();
                        done();
                        break;

                    default:
                        done(new Error('接收到的消息名称有问题：' + name));
                        break;
                }
            });

            await c_socket.send('1');
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')])
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('3', undefined, false)
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false)
            expect(c_socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试乱序收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            s_socket.on('message', (name, data) => {
                index++;
                switch (name) {
                    case '1':
                        expect(index).to.be(1);

                        expect(data).to.be.empty();
                        break;

                    case '2':
                        expect(index).to.be(2);

                        expect(data[0]).to.be(0);
                        expect(data[1]).to.be(1.1);
                        expect(data[2]).to.be('2');
                        expect(data[3]).to.be(true);
                        expect(data[4]).to.be(false);
                        expect(data[5]).to.be(null);
                        expect(data[6]).to.be(undefined);
                        expect(data[7]).to.be.eql({ a: 123 });
                        expect(data[8]).to.be.eql([1, 2, 3]);
                        expect(Buffer.from('123').equals(data[9])).to.be.ok();
                        break;

                    case '3':
                        expect(index).to.be(3);

                        expect(data).to.be.empty();
                        break;

                    case '4':
                        expect(index).to.be(4);

                        expect(data[0]).to.be(1);
                        expect(data[1]).to.be(2.1);
                        expect(data[2]).to.be('3');
                        expect(data[3]).to.be(false);
                        expect(data[4]).to.be(true);
                        expect(data[5]).to.be(undefined);
                        expect(data[6]).to.be(null);
                        expect(data[7]).to.be.eql({ a: 456 });
                        expect(data[8]).to.be.eql([4, 5, 6]);
                        expect(Buffer.from('789').equals(data[9])).to.be.ok();
                        done();
                        break;

                    default:
                        done(new Error('接收到的消息名称有问题：' + name));
                        break;
                }
            });

            expect(c_socket.send('1').messageID).to.be(0);
            expect(c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]).messageID).to.be(1);
            expect(c_socket.send('3', undefined, false).messageID).to.be(2);
            expect(c_socket.bufferedAmount).to.not.be(0);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false)
            expect(c_socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试取消发送', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            s_socket.on('message', (name, data) => {
                index++;
                switch (name) {
                    case '1':
                        expect(index).to.be(1);

                        expect(data).to.be.empty();
                        break;
                    case '4':
                        expect(index).to.be(2);

                        expect(data[0]).to.be(1);
                        expect(data[1]).to.be(2.1);
                        expect(data[2]).to.be('3');
                        expect(data[3]).to.be(false);
                        expect(data[4]).to.be(true);
                        expect(data[5]).to.be(undefined);
                        expect(data[6]).to.be(null);
                        expect(data[7]).to.be.eql({ a: 456 });
                        expect(data[8]).to.be.eql([4, 5, 6]);
                        expect(Buffer.from('789').equals(data[9])).to.be.ok();
                        done();
                        break;

                    default:
                        done(new Error('接收到的消息有问题：' + name));
                        break;
                }
            });

            const m1 = c_socket.send('1');
            const m1_size = c_socket.bufferedAmount;
            expect(m1_size).to.not.be(0);
            expect(c_socket.cancel(m1.messageID)).to.not.be.ok();
            expect(c_socket.bufferedAmount).to.not.be(0);

            const m2 = c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]);
            expect(c_socket.bufferedAmount).to.above(m1_size);
            expect(c_socket.cancel(m2.messageID)).to.be.ok();
            expect(c_socket.bufferedAmount).to.be(m1_size);

            const m3 = c_socket.send('3', undefined, false);
            expect(c_socket.bufferedAmount).to.above(m1_size);
            m3.then(() => { throw new Error('不可能会执行到这') }).catch((err: Error) => expect(err.message).to.be('cancel m3'));
            expect(c_socket.cancel(m3.messageID, new Error('cancel m3'))).to.be.ok();
            expect(c_socket.bufferedAmount).to.be(m1_size);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
            expect(c_socket.bufferedAmount).to.be(0);
        })();
    });
});

