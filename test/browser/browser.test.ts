import * as BWS from '../../bin/browser/index.js';
const Buffer = require('buffer/').Buffer;

describe('数据收发测试', function () {
    let socket: BWS.BinaryWS;    //客户端接口

    beforeEach(function (done) {    //创建连接
        socket = new BWS.BinaryWS();
        socket.on('error', (err) => done(err));
        socket.on('open', () => done());
    });

    afterEach(function (done) {
        socket.on('close', () => {
            (<any>socket) = undefined;
            done();
        });
        socket.close();
    });

    it('检查socket的属性是否正确', function () {
        expect(socket.bufferedAmount).to.be(0);
        expect(socket.readyState).to.be(BWS.ReadyState.OPEN);
        expect(socket.url).to.be('ws://localhost:8080');
        expect(socket.platform).to.be('browser');
    });

    it.only('测试顺序收发消息', function (done) {
        this.timeout(100000);
        (async () => {
            let index = 0;  //接收的顺序

            socket.on('message', (name, data) => {
                index++;
                expect(name.startsWith("server:")).to.be.ok();
                switch (name.slice("server:".length)) {
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

            await socket.send('1');
            expect(socket.bufferedAmount).to.be(0);

            await socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]);
            expect(socket.bufferedAmount).to.be(0);

            await socket.send('3', undefined, false);
            expect(socket.bufferedAmount).to.be(0);

            await socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
            expect(socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试乱序收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            socket.on('message', (name, data) => {
                index++;
                expect(name.startsWith("server:")).to.be.ok();
                switch (name.slice("server:".length)) {
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

            expect(socket.send('1').messageID).to.be(0);
            expect(socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]).messageID).to.be(1);
            expect(socket.send('3', undefined, false).messageID).to.be(2);
            expect(socket.bufferedAmount).to.not.be(0);

            await socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
            expect(socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试直接发送Buffer', function (done) {
        (async () => {//存在未序列化buffer的情况
            let index = 0;  //接收的顺序

            socket.on('message', (name, data) => {
                index++;
                expect(name.startsWith("server:")).to.be.ok();
                switch (name.slice("server:".length)) {
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

            expect(socket.send('1', BWS.BinaryWS.serialize([Buffer.from('123')])).messageID).to.be(0);
            expect(socket.bufferedAmount).to.not.be(0);

            await socket.send('2', Buffer.from('456'))    // 未经过BWS.Socket.serialize序列化的数据不能被发送
                .then(() => { throw new Error('不可能执行到这') })
                .catch(err => expect(err).to.be.a(Error));

            await socket.send('2', BWS.BinaryWS.serialize([Buffer.from('asd')]), false);
            expect(socket.bufferedAmount).to.be(0);
        })();
    });

    it('测试取消发送', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            socket.on('message', (name, data) => {
                index++;
                expect(name.startsWith("server:")).to.be.ok();
                switch (name.slice("server:".length)) {
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

            const m1 = socket.send('1');
            const m1_size = socket.bufferedAmount;
            expect(m1_size).to.not.be(0);
            expect(socket.cancel(m1.messageID)).to.not.be.ok();
            expect(socket.bufferedAmount).to.not.be(0);

            const m2 = socket.send('2', [0, 1.1, '2', true, false, null, undefined, { a: 123 }, [1, 2, 3], Buffer.from('123')]);
            expect(socket.bufferedAmount).to.above(m1_size);
            expect(socket.cancel(m2.messageID)).to.be.ok();
            expect(socket.bufferedAmount).to.be(m1_size);

            const m3 = socket.send('3', undefined, false);
            expect(socket.bufferedAmount).to.above(m1_size);
            m3.then(() => { throw new Error('不可能会执行到这') }).catch((err: Error) => expect(err.message).to.be('cancel m3'));
            expect(socket.cancel(m3.messageID, new Error('cancel m3'))).to.be.ok();
            expect(socket.bufferedAmount).to.be(m1_size);

            await socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6], Buffer.from('789')], false);
            expect(socket.bufferedAmount).to.be(0);
        })();
    });
});