import { Injectable, Logger } from '@nestjs/common';

import { ProcessingService } from './services/processing.service';
import { BlockService } from './modules/queue/services/block.service';
import { UtilityService } from './utils/utility.service';

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

import * as MerkleTree from './abi/tree.json'

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
const startBlock = Number(chain === 'goerli' ? process.env.ORIGIN_BLOCK_GOERLI : process.env.ORIGIN_BLOCK_MAINNET);

@Injectable()
export class AppService {

  constructor(
    private readonly blockSvc: BlockService,
    private readonly processSvc: ProcessingService,
    private readonly utilSvc: UtilityService
  ) {
    this.blockSvc.clearQueue().then(() => {
      Logger.debug('Queue Cleared', chain.toUpperCase());
      this.startIndexer();
    });
  }

  // Start Indexer //
  async startIndexer() {
    try {
      await this.utilSvc.delay(3000);

      const jobs = await this.blockSvc.getJobCounts();
      console.log(jobs);

      await this.blockSvc.pauseQueue();

      Logger.debug('Starting Backfill', chain.toUpperCase());
      await this.processSvc.startBackfill(startBlock);
      await this.blockSvc.resumeQueue();

      Logger.debug('Starting Block Watcher', chain.toUpperCase());
      this.processSvc.startPolling();
    } catch (error) {
      Logger.error(error);
      // Pause indexer for 30 seconds and try again
      await this.utilSvc.delay(30000);
      this.startIndexer();
    }
  }

  getMerkleProofs(leaf: string): any {
    // return '';
    const tree = StandardMerkleTree.load(MerkleTree as any);
    const root = tree.root;
    let proof = tree.getProof([leaf]);

    console.log(root);
    return leaf + proof.map(p => p.substring(2)).join('');
  }

  getMerkleRoot(): string {
    // return '';
    const tree = StandardMerkleTree.load(MerkleTree as any);
    return tree.root
  }
}
