import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';

import dotenv from 'dotenv';
dotenv.config();

const startBlock = Number(process.env.ORIGIN_BLOCK_MAINNET);

@Injectable()
export class AppService {

  constructor(
    private readonly web3Svc: Web3Service,
  ) {

    this.web3Svc.startBackfill(startBlock).then(() => {
      Logger.debug('Starting Block Watcher');
      this.web3Svc.startPolling();
    });
  }
}
