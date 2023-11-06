import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { ProcessingService } from './services/processing.service';
import { BlockService } from './modules/queue/services/block.service';
import { UtilityService } from './services/utility.service';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
const startBlock = Number(chain === 'goerli' ? process.env.ORIGIN_BLOCK_GOERLI : process.env.ORIGIN_BLOCK_MAINNET);

@Injectable()
export class AppService implements OnApplicationBootstrap {

  constructor(
    private readonly blockSvc: BlockService,
    private readonly processSvc: ProcessingService,
    private readonly utilsSvc: UtilityService
  ) {}

  async onApplicationBootstrap() {

    await this.blockSvc.pauseQueue();

    Logger.debug('Starting Backfill', chain.toUpperCase());
    await this.processSvc.startBackfill(startBlock);
    await this.blockSvc.resumeQueue();

    Logger.debug('Starting Block Watcher', chain.toUpperCase());
    this.processSvc.startPolling();
  }
}
