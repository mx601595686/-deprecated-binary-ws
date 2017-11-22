import * as BWS from '../..';

// 这里的测试基本上都是照搬server.test.ts的内容

describe('数据收发测试', function () {
    let c_socket: BWS.BrowserSocket;    //客户端接口

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.BrowserSocket();
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            done();
        });
    });

    it('检查socket的属性是否正确', function () {
        expect(c_socket.bufferedAmount).to.be(0);
        expect(c_socket.readyState).to.be(BWS.ReadyState.OPEN);
        expect(c_socket.url).to.be('ws://localhost:8080');
    });

    it('测试收发消息', function (done) {
        (async () => {
            let index = 0;  //接收的顺序

            c_socket.on('message', (name, data) => {
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

            c_socket.on('message', (name, data) => {
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


describe('压力测试', function () {
    let c_socket: BWS.BrowserSocket;    //客户端接口

    beforeEach(function (done) {    //创建连接
        c_socket = new BWS.BrowserSocket();
        c_socket.on('error', (err) => { throw err });
        c_socket.on('open', () => {
            done();
        });
    });

    it('双向收发数据1000次', function (done) {
        this.timeout(100000);

        let index1 = 0;

        c_socket.on('message', function (title, data) {
            expect(title).to.be(index1.toString());
            expect(data.toString()).to.be(index1.toString());
            index1++;
            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index1', index1);

            if (index1 === 1000)
                setTimeout(() => {
                    done();
                }, 1000);
        });

        for (var index = 0; index < 1000; index++) {
            c_socket.send(index.toString(), Buffer.from(index.toString()));
        }
    });
});
