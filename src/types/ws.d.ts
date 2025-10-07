declare module 'ws' {
  import { EventEmitter } from 'node:events';
  import { IncomingMessage } from 'node:http';

  export type RawData = string | Buffer | ArrayBuffer | Buffer[];

  export class WebSocket extends EventEmitter {
    readyState: number;
    send(data: RawData | ArrayBufferView, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string | Buffer): void;
    on(event: 'message', listener: (data: RawData, isBinary: boolean) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface WebSocketServerOptions {
    port?: number;
    host?: string;
    server?: any;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: WebSocketServerOptions);
    on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    close(cb?: (err?: Error) => void): void;
  }
}
