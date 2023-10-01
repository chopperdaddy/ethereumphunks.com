import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
const startBlock = Number(chain === 'goerli' ? process.env.ORIGIN_BLOCK_GOERLI : process.env.ORIGIN_BLOCK_MAINNET);

@Injectable()
export class AppService {

  constructor(
    private readonly web3Svc: Web3Service,
  ) {

    this.web3Svc.startBackfill(startBlock).then(() => {
      Logger.debug('Starting Block Watcher', chain.toUpperCase());
      this.web3Svc.startPolling(chain === 'goerli' ? 2 : 16);
    });
  }
}
