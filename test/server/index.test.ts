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

describe('测试ServerSocket', function () {

    describe('数据收发测试', function () {
        let server: BWS.Server;

        let s_socket: BWS.ServerSocket;    //服务器端对应的接口
        let c_socket: BWS.ServerSocket;    //客户端接口

        before(function (done) {    // 打开服务器
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done);
            server.close();
        });

        beforeEach(function (done) {    //创建连接
            c_socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
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
            expect(s_socket.url).to.be('ws://localhost:8080');
            expect(c_socket.url).to.be('ws://localhost:8080');
        });

        it('测试收发消息', function (done) {
            (async () => {
                let index = 0;  //接收的顺序

                s_socket.on('message', (name, data) => {
                    index++;
                    switch (name) {
                        case '1':
                            expect(index).to.be(1);
                            expect(data.length).to.be(0);
                            break;

                        case '2':
                            expect(index).to.be(2);
                            expect(Buffer.from('123').equals(data)).to.be.ok();
                            done();
                            break;

                        default:
                            done(new Error('接收到的消息名称有问题：' + name));
                            break;
                    }
                });

                await c_socket.send('1', Buffer.alloc(0));
                expect(c_socket.bufferedAmount).to.be(0);

                await c_socket.send('2', Buffer.from('123'));
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
                            expect(data.length).to.be(0);
                            done();
                            break;

                        default:
                            done(new Error('接收到的消息有问题：' + name));
                            break;
                    }
                });

                const m1 = c_socket.send('1', Buffer.alloc(0));
                const m1_size = c_socket.bufferedAmount;

                const m2 = c_socket.send('2', Buffer.from('123'));
                m2.catch(() => { });

                expect(c_socket.bufferedAmount).to.above(m1_size);
                c_socket.cancel(m2.messageID);
                expect(c_socket.bufferedAmount).to.be(m1_size);
            })();
        });
    });

    describe('连接中断测试', function () {
        let server: BWS.Server;

        let s_socket: BWS.ServerSocket;    //服务器端对应的接口
        let c_socket: BWS.ServerSocket;    //客户端接口

        before(function (done) {    // 打开服务器
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        beforeEach(function (done) {    //创建连接
            c_socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
            c_socket.on('error', (err) => { throw err });
            c_socket.on('open', () => {
                expect(server.clients.size).to.be(1);
                s_socket = server.clients.values().next().value;
                done();
            });
        });

        it('测试断开连接取消发送', function (done) {
            s_socket.on('message', (name, data) => {
                done(new Error('1不可能执行到这里，代码逻辑存在错误'));
            });

            server.close();
            c_socket.close();

            let triggered = 0;

            c_socket.send('1', Buffer.alloc(0))
                .then(() => { done(new Error('2不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });

            c_socket.send('2', Buffer.alloc(0))
                .then(() => { done(new Error('3不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });

            c_socket.send('3', Buffer.alloc(0))
                .then(() => { done(new Error('4不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); triggered++ });

            expect(c_socket.bufferedAmount).to.not.be(0);

            c_socket.on('close', () => {
                setTimeout(() => {
                    expect(triggered).to.be(3);
                    done();
                }, 1000);
            });
        });
    });

    describe('数据包大小限制测试', function () {
        let server: BWS.Server;

        before(function (done) {
            const hs = http.createServer();
            hs.listen(8080);
            server = new BWS.Server(hs, { url: 'ws://localhost:8080', maxPayload: 100 });
            server.on('error', err => { throw err });
            server.on('listening', done);
        });

        after(function (done) {
            server.on('close', done);
            server.close();
        });

        describe('在限制范围之内', function () {
            let s_socket: BWS.ServerSocket;    //服务器端对应的接口
            let c_socket: BWS.ServerSocket;    //客户端接口

            beforeEach(function (done) {    //创建连接
                c_socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
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

            it('测试在限制范围之内', function (done) {
                s_socket.on('message', (name, data) => {
                    expect(name).to.be('1');
                    expect(Buffer.alloc(99).fill(1).equals(data)).to.be.ok();
                    done();
                });
                c_socket.send('1', Buffer.alloc(99).fill(1));
            });
        });

        describe('超过限制的范围', function () {
            let s_socket: BWS.ServerSocket;    //服务器端对应的接口
            let c_socket: BWS.ServerSocket;    //客户端接口

            beforeEach(function (done) {    //创建连接
                c_socket = new BWS.ServerSocket({ url: 'ws://localhost:8080', maxPayload: 100 });
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

            it('设置了maxPayload', function (done) {
                (async () => {
                    s_socket.on('message', () => done(new Error('不可能执行到这里，代码逻辑存在错误')));
                    s_socket.on('error', () => done(new Error('不可能执行到这里，代码逻辑存在错误')));

                    c_socket.send('1', Buffer.alloc(100))
                        .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                        .catch(err => { expect(err).to.be.a(Error); done(); });

                    expect(c_socket.readyState).to.be(BWS.ReadyState.OPEN);
                })();
            });
        });
    });
});

describe('压力测试', function () {
    let server: BWS.Server;

    let s_socket: BWS.ServerSocket;    //服务器端对应的接口
    let c_socket: BWS.ServerSocket;    //客户端接口

    before(function (done) {    // 打开服务器
        const hs = http.createServer();
        hs.listen(8080);
        server = new BWS.Server(hs, { url: 'ws://localhost:8080' });
        server.on('error', err => { throw err });
        server.on('listening', done);
    });

    after(function (done) {
        server.on('close', done);
        server.close();
    });

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.ServerSocket({ url: 'ws://localhost:8080' });
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

    it('双向收发数据1000次，碰到5则取消发送', function (done) {
        this.timeout(100000);

        let index1 = 0;
        let index2 = 0;

        s_socket.on('message', function (title, data) {
            expect(title).to.be(index1.toString());
            expect(data.toString()).to.be(index1.toString());
            index1++;
            if (index1 % 5 === 0) index1++;

            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index1', title);
        });

        c_socket.on('message', function (title, data) {
            expect(title).to.be(index2.toString());
            expect(data.toString()).to.be(index2.toString());
            index2++;
            if (index2 % 5 === 0) index2++;

            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index2', title);

            if (index2 === 999)
                setTimeout(() => {
                    done();
                }, 1000);
        });

        for (var index = 0; index < 1000; index++) {
            const m1 = s_socket.send(index.toString(), Buffer.from(index.toString()));
            const m2 = c_socket.send(index.toString(), Buffer.from(index.toString()));

            m1.catch(() => { });
            m2.catch(() => { });

            if (index % 5 === 0) {
                s_socket.cancel(m1.messageID);
                c_socket.cancel(m2.messageID);
            }
        }
    });
});
