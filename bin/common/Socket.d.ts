/// <reference types="ws" />
import * as WS from 'ws';
import * as Emitter from 'component-emitter';
export declare class Socket extends Emitter {
    private static _id_Number;
    readonly id: string;
    constructor(client: WS);
}
