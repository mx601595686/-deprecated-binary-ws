import * as WS from 'ws';
import * as Emitter from 'component-emitter';

export class Socket extends Emitter {

    private static _id_Number = 0;

    readonly id = (Socket._id_Number++).toString();

    constructor(client: WS) {
        super();
    }
}