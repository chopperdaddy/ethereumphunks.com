import { Injectable } from '@angular/core';
import { Socket, SocketIoConfig } from 'ngx-socket-io';
import { shareReplay } from 'rxjs';

export interface GasData {
  FastGasPrice: string;
  LastBlock: string;
  ProposeGasPrice: string;
  SafeGasPrice: string;
  gasUsedRatio: string;
  suggestBaseFee: string;
}

const socketConfig: SocketIoConfig = {
  url: 'https://flooredApe.io',
  options: {
    path: '/api/v1/socket.io/'
  }
};

@Injectable({
  providedIn: 'root',
})
export class GasService extends Socket {

  /** Observable stream of gas data */
  gas$ = this.fromEvent<GasData, 'gasData'>('gasData').pipe(
    shareReplay(1)
  );

  constructor() {
    super(socketConfig);
  }

  connect(callback?: ((err: any) => void) | undefined): this {
    super.connect();
    return this;
  }

  /**
   * Checks if socket is connected and reconnects if needed
   */
  ensureConnected(): this {
    if (!this.ioSocket?.connected) {
      console.log('Gas service socket not connected, reconnecting...');
      this.connect();
    }
    return this;
  }
}
