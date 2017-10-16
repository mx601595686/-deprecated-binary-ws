import * as BWS from '../../bin/browser/index';

// 这里的测试基本上都是照搬server.test.ts的内容

describe('数据收发测试', function () {

    let c_socket: BWS.Socket;    //客户端接口

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.Socket();
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            done();
        });
    });

    afterEach(function (done) {
        c_socket.on('close', () => {
            (<any>c_socket) = undefined;
            done();
        });
        c_socket.close();
    });

    it('检查socket的属性是否正确', function () {
        expect(c_socket.bufferedAmount).to.be(0);
        expect(c_socket.readyState).to.be(BWS.ReadyState.OPEN);
        expect(c_socket.url).to.be(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`);
    });

    it('测试顺序收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[9])).to.be.ok();
                        expect(Buffer.from((new Uint32Array(10)).fill(1).buffer).equals(data[10])).to.be.ok();
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[11])).to.be.ok();
                        expect(Buffer.from('123').equals(data[12])).to.be.ok();
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
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[9])).to.be.ok();
                        expect(Buffer.from((new Uint32Array(10)).fill(1).buffer).equals(data[10])).to.be.ok();
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[11])).to.be.ok();
                        expect(Buffer.from('789').equals(data[12])).to.be.ok();
                        done();
                        break;

                    default:
                        done(new Error('接收到的消息名称有问题：' + name));
                        break;
                }
            });

            await c_socket.send('1');
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3],
                (new ArrayBuffer(10)),
                (new Uint32Array(10)).fill(1),
                (new DataView(new ArrayBuffer(10))),
                Buffer.from('123')]);
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('3', undefined, false);
            expect(c_socket.bufferedAmount).to.be(0);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6],
                (new ArrayBuffer(10)),
                (new Uint32Array(10)).fill(1),
                (new DataView(new ArrayBuffer(10))),
                Buffer.from('789')], false);
            expect(c_socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试乱序收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[9])).to.be.ok();
                        expect(Buffer.from((new Uint32Array(10)).fill(1).buffer).equals(data[10])).to.be.ok();
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[11])).to.be.ok();
                        expect(Buffer.from('123').equals(data[12])).to.be.ok();
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
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[9])).to.be.ok();
                        expect(Buffer.from((new Uint32Array(10)).fill(1).buffer).equals(data[10])).to.be.ok();
                        expect(Buffer.from(new ArrayBuffer(10)).equals(data[11])).to.be.ok();
                        expect(Buffer.from('789').equals(data[12])).to.be.ok();
                        done();
                        break;

                    default:
                        done(new Error('接收到的消息名称有问题：' + name));
                        break;
                }
            });

            expect(c_socket.send('1').messageID).to.be(0);
            expect(c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3],
                (new ArrayBuffer(10)),
                (new Uint32Array(10)).fill(1),
                (new DataView(new ArrayBuffer(10))),
                Buffer.from('123')]).messageID).to.be(1);
            expect(c_socket.send('3', undefined, false).messageID).to.be(2);
            expect(c_socket.bufferedAmount).to.not.be(0);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6],
                (new ArrayBuffer(10)),
                (new Uint32Array(10)).fill(1),
                (new DataView(new ArrayBuffer(10))),
                Buffer.from('789')], false);
            expect(c_socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试取消发送', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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

    it('测试优先发送', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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
                        expect(index).to.be(4);

                        expect(data).to.be.empty();
                        done();
                        break;

                    case '4':
                        expect(index).to.be(3);

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
                        break;

                    default:
                        done(new Error('接收到的消息名称有问题：' + name));
                        break;
                }
            });

            c_socket.send('1');

            c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')], true, true);

            c_socket.send('3', undefined, false);

            await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false, true);
        })();
    });

    it('测试优先发送+取消发送', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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
                        done(new Error('程序逻辑存在问题'));
                        break;

                    case '4':
                        expect(index).to.be(3);

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

            const m1 = c_socket.send('1');
            expect(c_socket.cancel(m1.messageID)).to.not.be.ok();

            const m2 = c_socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')], true, true);
            expect(c_socket.cancel(m2.messageID)).to.not.be.ok();

            const m3 = c_socket.send('3', undefined, false);
            expect(c_socket.cancel(m3.messageID)).to.be.ok();

            const m4 = await c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false, true);
        })();
    });
});

describe('连接中断测试', function () {
    let c_socket: BWS.Socket;    //客户端接口

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.Socket();
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            done();
        });
    });

    afterEach(function () {
        (<any>c_socket) = undefined;
    });

    it('测试断开连接取消发送', function (done) {
        c_socket.on('message', (name, data) => {
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

        c_socket.close();
    });
});

describe('数据包大小限制测试', function () {

    describe('在限制范围之内', function () {
        let c_socket: BWS.Socket;    //客户端接口

        beforeEach(function (done) {    //创建连接
            c_socket = new BWS.Socket();
            c_socket.on('error', (err) => { throw err });
            c_socket.on('open', () => {
                done();
            });
        });

        afterEach(function (done) {
            c_socket.on('close', () => {
                (<any>c_socket) = undefined;
                done();
            });
            c_socket.close();
        });

        it('测试在限制范围之内', function (done) {
            c_socket.on('message', (name, data) => {
                expect(name).to.be('1');
                expect(Buffer.alloc(1000).fill(1).equals(data[0])).to.be.ok();
                done();
            });
            c_socket.send('1', [Buffer.alloc(1000).fill(1)]);
        });
    });

    describe('超过限制的范围', function () {
        let c_socket: BWS.Socket;    //客户端接口

        beforeEach(function (done) {    //创建连接
            c_socket = new BWS.Socket();
            c_socket.on('error', (err) => { throw err });
            c_socket.on('open', () => {
                done();
            });
        });

        afterEach(function () {
            (<any>c_socket) = undefined;
        });

        it('未设置maxPayload', function (done) {
            this.timeout(10000);

            let c_socket_error = false;

            c_socket.on('message', (name, data) => {
                done(new Error('不可能执行到这里，代码逻辑存在错误'));
            });

            c_socket.on('close', function () {
                setTimeout(() => {
                    expect(c_socket_error).to.be.ok();
                    done();
                }, 1000);
            });

            c_socket.send('1', [Buffer.alloc(2000)])
                .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                .catch(err => { expect(err).to.be.a(Error); c_socket_error = true; });
        });
    });

    describe('超过限制的范围2', function () {
        let c_socket: BWS.Socket;    //客户端接口

        beforeEach(function (done) {    //创建连接
            c_socket = new BWS.Socket({ url: `ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`, maxPayload: 2000 });
            c_socket.on('error', (err) => { throw err });
            c_socket.on('open', () => {
                done();
            });
        });

        afterEach(function (done) {
            c_socket.on('close', () => {
                (<any>c_socket) = undefined;
                done();
            });
            c_socket.close();
        });

        it('设置了maxPayload', function (done) {
            (async () => {
                await c_socket.send('1', [Buffer.alloc(2000)])
                    .then(() => { done(new Error('不可能执行到这里，代码逻辑存在错误')) })
                    .catch(err => { expect(err).to.be.a(Error); done(); });
                expect(c_socket.readyState).to.be(BWS.ReadyState.OPEN);
            })();
        });
    });
});

describe('压力测试', function () {
    let c_socket: BWS.Socket;    //客户端接口

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.Socket();
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            done();
        });
    });

    afterEach(function (done) {
        c_socket.on('close', () => {
            (<any>c_socket) = undefined;
            done();
        });
        c_socket.close();
    });

    it('双向收发数据1000次', function (done) {
        this.timeout(100000);

        let index = 0;

        c_socket.on('message', function (name, data) {
            expect(name).to.be('c_socket');
            expect(data[0]).to.be(index);
            expect(data[1]).to.be(index + 0.1);
            expect(data[2]).to.be(index.toString());
            expect(data[3]).to.be(true);
            expect(data[4]).to.be(false);
            expect(data[5]).to.be(null);
            expect(data[6]).to.be(undefined);
            expect(data[7]).to.be.eql({ a: index });
            expect(data[8]).to.be.eql([index]);
            expect(Buffer.from(index.toString()).equals(data[9])).to.be.ok();
            index++;
            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index', index);

            if (index === 1000)
                setTimeout(() => {
                    done();
                }, 1000);
        });

        for (var i = 0; i < 1000; i++) {
            const data = [i, i + 0.1, i.toString(), true, false, null, undefined, { a: i }, [i], Buffer.from(i.toString())];
            c_socket.send('c_socket', data);
        }
    });
});