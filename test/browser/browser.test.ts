import * as BWS from '../../bin/browser/index';

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
        expect(c_socket.url).to.be('ws://localhost:8080');
        expect(c_socket.platform).to.be('browser');
    });

    it('测试收发消息', function (done) {
        let index = 0;  //接收的顺序

        c_socket.on('message', (name, data) => {
            index++;
            switch (name) {
                case 'server:1':
                    expect(index).to.be(1);

                    expect(data).to.be.empty();
                    break;

                case 'server:2':
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

                case 'server:3':
                    expect(index).to.be(3);

                    expect(data).to.be.empty();
                    break;

                case 'server:4':
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
            Buffer.from('123')
        ]).messageID).to.be(1);

        expect(c_socket.send('3', undefined, false).messageID).to.be(2);
        expect(c_socket.send('4', [1, 2.1, '3', false, true, undefined, null, { a: 456 }, [4, 5, 6],
            (new ArrayBuffer(10)),
            (new Uint32Array(10)).fill(1),
            (new DataView(new ArrayBuffer(10))),
            Buffer.from('789')
        ], false).messageID).to.be(3);
    });
});