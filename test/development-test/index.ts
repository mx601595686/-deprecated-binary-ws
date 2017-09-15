import { Server } from '../..';
import * as http from 'http';
import * as WS from 'ws';
import * as fs from 'fs-extra';
import * as path from 'path';

const server = http.createServer((req, res) => {
    fs.readFile(path.resolve(__dirname, './test.html'), (err, data) => {
        res.end(data);
    })
})

const ws = new WS.Server({ server });
ws.on('connection', (client) => {
    console.log('有客户连接')
    client.on('message', (data) => {
        console.log(data.toString());
        client.send(data.toString());
    });
    /*     let index = 0;
        const t = setInterval(function () {
            try {
                client.send(Buffer.from([index++]));
            } catch (error) {
                clearInterval(t);
            }
        }, 1000); */
})

server.listen(8080,"192.168.232.154")