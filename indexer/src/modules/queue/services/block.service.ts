// test.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';

import { Queue } from 'bull';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';

@Injectable()
export class BlockService {
  constructor(
    @InjectQueue('blockProcessingQueue') private readonly queue: Queue
  ) {
    this.queue.on('completed', (job) => {
      this.saveBlockNumber(job.data.blockNum);
    });
  }

  async addBlockToQueue(blockNum: number) {
    const jobId = `block_${blockNum}__${chain}`;

    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      Logger.error(`Block ${blockNum} already in queue`);
      return;
    }

    await this.queue.add('blockNumQueue', { blockNum }, { jobId });
    Logger.log(`Added block ${blockNum} to queue`);
  }

  async getOrCreateBlockFile(block: number): Promise<number> {
    return Number(process.env.ORIGIN_BLOCK_GOERLI);
    // let newBlock = block;
    // try {
    //   const blockFromFile = await readFile(`lastBlock-${chain}.txt`, 'utf8');
    //   if (!blockFromFile) await writeFile(`lastBlock-${chain}.txt`, newBlock.toString());
    //   if (blockFromFile) newBlock = Number(blockFromFile.toString());
    //   return newBlock;
    // } catch (err) {
    //   Logger.error(err.message);
    //   return newBlock;
    // }
  }

  async saveBlockNumber(block: number): Promise<void> {
    // await writeFile(`lastBlock-${chain}.txt`, block.toString());
    // Logger.log(`Saved block ${block} to file`);
  }

  async pauseQueue() {
    await this.queue.pause();
  }

  async resumeQueue() {
    await this.queue.resume();
  }

  async clearQueue(): Promise<void> {
    await this.queue.clean(0, 'completed');
    await this.queue.clean(0, 'wait');
    await this.queue.clean(0, 'active');
    await this.queue.clean(0, 'delayed');
    await this.queue.clean(0, 'failed');
  }
}
