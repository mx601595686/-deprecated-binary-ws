import { Server } from '..';
import * as http from 'http';

const server = http.createServer((req, res) => {
    res.end('hello world');
})

debugger
const ws = new Server(server);
server.listen(8080);