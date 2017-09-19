import * as BWS from '../../bin/browser/index.js';
debugger
const ws = new BWS.Socket();

ws.on("open", function () {
    console.log(123);
});
