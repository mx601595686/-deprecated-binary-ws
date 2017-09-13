import expect = require('expect.js');
import * as BWS from '../';

describe('测试Server启动与关闭', function () {
    let server: BWS.Server;

    it('测试listening事件', function (done) {
        server = new BWS.Server(8080);  //测试时会用到8080端口，确保这个端口不会被占用
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