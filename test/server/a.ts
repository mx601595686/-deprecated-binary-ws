


describe('压力测试', function () {
    let server: BWS.Server;

    let c_socket1: BWS.Socket;    //客户端接口1
    let c_socket2: BWS.Socket;    //客户端接口2

    before(function (done) {    // 打开服务器
        server = new BWS.Server();
        server.on('error', err => { throw err });
        server.on('listening', done);
    });

    after(function (done) {
        server.on('close', done);
        server.close();
    });

    beforeEach(function (done) {    //创建连接
        c_socket1 = new BWS.Socket('ws://localhost:8080');
        c_socket1.on('error', (err) => { throw err });

        c_socket2 = new BWS.Socket('ws://localhost:8080');
        c_socket2.on('error', (err) => { throw err });

        setTimeout(() => {
            expect(server.clients.size).to.be(2);
            const [sck1, sck2] = [...server.clients.values()];
            sck1.on('message', (name, data) => {
                sck2.send(name, data).catch((err) => { throw err });
            });
            sck2.on('message', (name, data) => {
                sck1.send(name, data).catch((err) => { throw err });
            });
            done();
        }, 1000);
    });

    afterEach(function (done) {
        c_socket1.close();
        c_socket2.close();
        setTimeout(() => {
            expect(server.clients.size).to.be(0);
            (<any>c_socket1) = undefined;
            (<any>c_socket2) = undefined;
            done();
        }, 1000);
    });

    it('双向收发数据1000次', function (done) {
        this.timeout(100000);

        let index1 = 0;
        let index2 = 0;

        c_socket1.on('message', function (name, data) {
            expect(name).to.be('c_socket2');
            expect(data[0]).to.be(index1);
            expect(data[1]).to.be(index1 + 0.1);
            expect(data[2]).to.be(index1.toString());
            expect(data[3]).to.be(true);
            expect(data[4]).to.be(false);
            expect(data[5]).to.be(null);
            expect(data[6]).to.be(undefined);
            expect(data[7]).to.be.eql({ a: index1 });
            expect(data[8]).to.be.eql([index1]);
            expect(Buffer.from(index1.toString()).equals(data[9])).to.be.ok();
            index1++;
            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index1', index1);
        });

        c_socket2.on('message', function (name, data) {
            expect(name).to.be('c_socket1');
            expect(data[0]).to.be(index2);
            expect(data[1]).to.be(index2 + 0.1);
            expect(data[2]).to.be(index2.toString());
            expect(data[3]).to.be(true);
            expect(data[4]).to.be(false);
            expect(data[5]).to.be(null);
            expect(data[6]).to.be(undefined);
            expect(data[7]).to.be.eql({ a: index2 });
            expect(data[8]).to.be.eql([index2]);
            expect(Buffer.from(index2.toString()).equals(data[9])).to.be.ok();
            index2++;
            console.log(`[${(new Date()).toLocaleTimeString()}]`, 'index2', index2);

            if (index2 === 1000)
                setTimeout(() => {
                    done();
                }, 1000);
        });

        for (var index = 0; index < 1000; index++) {
            const data = [index, index + 0.1, index.toString(), true, false, null, undefined, { a: index }, [index], Buffer.from(index.toString())];
            c_socket1.send('c_socket1', data);
            c_socket2.send('c_socket2', data);
        }
    });
});
