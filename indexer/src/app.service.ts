import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';
import { TimeService } from './services/time.service';
import { ProcessingService } from './services/processing.service';

import { readFile, writeFile } from 'fs/promises';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
const startBlock = Number(chain === 'goerli' ? process.env.ORIGIN_BLOCK_GOERLI : process.env.ORIGIN_BLOCK_MAINNET);

@Injectable()
export class AppService {

  startTime: Date;
  lastBlock: number = 0;

  constructor(
    private readonly web3Svc: Web3Service,
    private readonly timeService: TimeService,
    private readonly processSvc: ProcessingService,
  ) {
    this.startBackfill(startBlock).then(() => {
      Logger.debug('Starting Block Watcher', chain.toUpperCase());
      this.startPolling(chain === 'goerli' ? 1 : 16);
    });
  }

  // Method to start fetching and processing blocks from the network
  async startBackfill(startBlock: number): Promise<void> {

    this.startTime = new Date();
    let block: number = await this.getOrCreateBlockFile(startBlock);

    while (block < this.lastBlock) {
      await this.processBlock(block);
      await this.saveBlockNumber(block);
      block++;
    }
  }

  async startPolling(blockDelay?: number): Promise<void> {
    blockDelay = blockDelay === -1 ? 0 : blockDelay;
    this.web3Svc.client.watchBlocks({
      onBlock: async (block) => {
        const blockNum = Number(block.number) - blockDelay;
        await this.processBlock(blockNum);
        await this.saveBlockNumber(blockNum);
      },
    });
  }

  async processBlock(block: number): Promise<void> {
    const { txns, createdAt } = await this.web3Svc.getBlockTransactions(block);

    await this.processSvc.processTransactions(txns, createdAt);

    // Log block processed
    this.timeService.logBlockProcessed();
    const timeSince = this.timeService.howLongAgo(createdAt.toString());
    const timeRemaining = this.timeService.getTimeRemainingEstimate(block, this.lastBlock);

    // Set last block to current block if it is a multiple of 16
    if (block % 16 === 0) this.lastBlock = await this.web3Svc.getBlockNumber();

    // Log block processed
    if (block % 100 === 0) Logger.verbose(`Time Remaining: ${timeRemaining} (${chain})`);
    Logger.debug(`Block Timestamp: ${timeSince}`, `Processing Block ${block} (${chain})`);
  }

  async getOrCreateBlockFile(block: number) {
    try {
      const blockFromFile = await readFile(`lastBlock-${chain}.txt`, 'utf8');
      if (!blockFromFile) await writeFile(`lastBlock-${chain}.txt`, block.toString());
      if (blockFromFile) block = Number(blockFromFile.toString());

      this.lastBlock = await this.web3Svc.getBlockNumber();

      return block;
    } catch (err) {
      Logger.error(err.message);
      // console.log(err);
      // await this.delay(5000);
      return block;
    }
  }

  async saveBlockNumber(block: number): Promise<void> {
    return await writeFile(`lastBlock-${chain}.txt`, block.toString());
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
