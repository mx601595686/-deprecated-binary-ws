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
        const socket: BWS.Socket[] = [];

        before(function (done) {
            server = new BWS.Server();
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        it('新建连接1', function name(done) {
            let s = new BWS.Socket('ws://localhost:8080');
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
            socket.push(s);
        });

        it('新建连接2', function name(done) {
            let s = new BWS.Socket('ws://localhost:8080');
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(2);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
            socket.push(s);
        });

        it('新建连接3', function name(done) {
            let s = new BWS.Socket('ws://localhost:8080');
            s.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(3);
                    expect(server.clients.values().next().value.platform).be('node');
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
        let socket: BWS.Socket;

        before(function (done) {
            server = new BWS.Server();
            server.on('listening', done);
        });

        beforeEach(function name(done) {
            socket = new BWS.Socket('ws://localhost:8080');
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    expect(server.clients.values().next().value.platform).be('node');
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
        let socket: BWS.Socket;

        before(function (done) {
            server = new BWS.Server();
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        beforeEach(function name(done) {
            socket = new BWS.Socket('ws://localhost:8080');
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
        });

        it('强制发送错误数据促使server断开连接', function (done) {
            let serverSocketError = false;  //服务器端server是否出现错误
            server.clients.values().next().value.on('error', () => serverSocketError = true);

            socket.on('close', () => { expect(serverSocketError).to.be.ok(); done(); });

            const testData: any = Buffer.from('123');
            testData._serialized = true;
            socket.send('test', testData);
        });
    });

    describe('测试不反序列化收到的数据', function () {
        let server: BWS.Server;
        let socket: BWS.Socket;

        before(function (done) {
            server = new BWS.Server({ needDeserialize: false });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done)
            server.close();
        });

        beforeEach(function name(done) {
            socket = new BWS.Socket('ws://localhost:8080');
            socket.on('open', function () {
                setTimeout(() => {
                    expect(server.clients.size).to.be(1);
                    expect(server.clients.values().next().value.platform).be('node');
                    done();
                }, 1000);
            });
        });

        it('检查收到的数据', function (done) {
            const sendArray = [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')];
            const sendingData = BWS.Socket.serialize(sendArray);
            server.clients.values().next().value.on('message', (name, data: Buffer) => {
                expect(name).to.be('test');
                expect(sendingData.equals(data)).to.be.ok();
                done();
            });
            socket.send('test', sendArray);
        });
    });
});

describe('测试Server Socket', function () {

    describe('数据收发测试', function () {
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

                await c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]);
                expect(c_socket.bufferedAmount).to.be(0);

                await c_socket.send('3', undefined, false);
                expect(c_socket.bufferedAmount).to.be(0);

                await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
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

                await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
                expect(c_socket.bufferedAmount).to.be(0);
            })();
        });

        it('测试直接发送Buffer', function (done) {
            (async () => {//存在未序列化buffer的情况
                let index = 0;  //接收的顺序

                s_socket.on('message', (name, data) => {
                    index++;
                    switch (name) {
                        case '1':
                            expect(index).to.be(1);
                            expect(Buffer.from('123').equals(data[0])).to.be.ok();
                            break;

                        case '2':
                            expect(index).to.be(2);
                            expect(Buffer.from('asd').equals(data[0])).to.be.ok();
                            done();
                            break;

                        default:
                            done(new Error('接收到的消息有问题：' + name));
                            break;
                    }
                });

                expect(c_socket.send('1', BWS.Socket.serialize([Buffer.from('123')])).messageID).to.be(0);
                expect(c_socket.bufferedAmount).to.not.be(0);

                await c_socket.send('2', Buffer.from('456'))    // 未经过BWS.Socket.serialize序列化的数据不能被发送
                    .then(() => { throw new Error('不可能执行到这') })
                    .catch(err => expect(err).to.be.a(Error));

                await c_socket.send('2', BWS.Socket.serialize([Buffer.from('asd')]), false);
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

    describe('连接中断测试', function () {
        let server: BWS.Server;

        let s_socket: BWS.Socket;    //服务器端对应的接口
        let c_socket: BWS.Socket;    //客户端接口

        before(function (done) {    // 打开服务器
            server = new BWS.Server();
            server.on('listening', done);
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

        it('测试断开连接取消发送', function (done) {
            s_socket.on('message', (name, data) => {
                done(new Error('不可能执行到这里，代码逻辑存在错误'));
            });

            let triggered = 0;

            c_socket.send('1', [1])
                .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });
            c_socket.send('2', [2], false)
                .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });
            c_socket.send('3', [3])
                .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });

            expect(c_socket.bufferedAmount).to.not.be(0);

            c_socket.on('close', () => {
                setTimeout(() => {
                    expect(triggered).to.be(3);
                    done();
                }, 1000);
            });

            server.close();
        });
    });
});

