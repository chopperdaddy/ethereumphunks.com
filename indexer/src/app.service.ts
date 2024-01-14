import { Injectable, Logger } from '@nestjs/common';

import { BlockService } from './modules/queue/services/block.service';

import { SupabaseService } from './services/supabase.service';
import { ProcessingService } from './services/processing.service';
import { Web3Service } from './services/web3.service';

import { UtilityService } from './utils/utility.service';

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

import * as MerkleTree from './abi/tree.json'

// import allBlocks from '../allblocks.json';
// import nogood from '../nogood.json';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '1' ? 'mainnet' : 'goerli';
const originBlock = Number(chain === 'mainnet' ? process.env.ORIGIN_BLOCK_MAINNET : process.env.ORIGIN_BLOCK_GOERLI);

@Injectable()
export class AppService {

  constructor(
    private readonly blockSvc: BlockService,
    private readonly processSvc: ProcessingService,
    private readonly sbSvc: SupabaseService,
    private readonly utilSvc: UtilityService,
    private readonly web3Svc: Web3Service
  ) {
    this.blockSvc.clearQueue().then(() => {
      Logger.debug('Queue Cleared', chain.toUpperCase());
      this.startIndexer();
    });
  }

  // Start Indexer //
  async startIndexer() {
    try {
      await this.utilSvc.delay(10000);
      await this.blockSvc.pauseQueue();

      const startBlock = await this.sbSvc.getLastBlock(Number(process.env.CHAIN_ID)) || originBlock;

      Logger.debug('Starting Backfill', chain.toUpperCase());
      await this.processSvc.startBackfill(startBlock);
      await this.blockSvc.resumeQueue();

      Logger.debug('Starting Block Watcher', chain.toUpperCase());
      await this.processSvc.startPolling();

    } catch (error) {
      Logger.error(error);
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

  // async reIndexTransactions() {
  //   // Takes an array of transaction hashes
  //   for (let i = 0; i < nogood.length; i++) {

  //     try {
  //       const hash = nogood[i] as `0x${string}`;
  //       console.log(hash);

  //       const [ transaction, receipt ] = await Promise.all([
  //         this.web3Svc.getTransaction(hash),
  //         this.web3Svc.getTransactionReceipt(hash),
  //       ]);

  //       const block = await this.web3Svc.getBlock(transaction.blockNumber);
  //       const createdAt = new Date(Number(block.timestamp) * 1000);

  //       await this.processSvc.processTransaction(
  //         transaction,
  //         receipt,
  //         createdAt,
  //       );
  //     } catch (error) {
  //       console.log(error);
  //       break;
  //     }

  //   }
  // }

  // async reIndexBlocks() {
  //   const allBlocks = [];
  //   const blocks = [...new Set(allBlocks)].sort((a, b) => a - b);
  //   console.log(blocks);
  //   for (let i = 0; i < blocks.length; i++) {
  //     const block = blocks[i];
  //     await this.processSvc.addBlockToQueue(block, new Date().getTime());
  //   }
  // }
}
