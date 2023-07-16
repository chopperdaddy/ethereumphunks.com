import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from './supabase.service';

import { PublicClient, createPublicClient, hexToString, http } from 'viem';
import { goerli, mainnet } from 'viem/chains';

import { readFile, writeFile } from 'fs/promises';

import punkDataABI from '../abi/PunkData.json';

import dotenv from 'dotenv';
dotenv.config();

const startBlock = Number(process.env.ORIGIN_BLOCK); // Default Origin

@Injectable()
export class Web3Service {

  rpcURL: string = 'http://geth.dappnode:8545';
  rpcURLGoerli: string = 'http://goerli-geth.dappnode:8545';

  client!: PublicClient;
  clientGoerli!: PublicClient;

  constructor(
    private readonly sbSvc: SupabaseService
  ) {
    this.client = createPublicClient({ chain: mainnet, transport: http(this.rpcURL) });

    // this.start(startBlock).then(() => {
    //   Logger.debug('Starting Block Watcher');
    // });

    this.client.watchBlocks({
      onBlock: async (block) => {
        const blockNum = Number(block.number);
        this.processBlock(blockNum - 32);
        this.processBlock(blockNum - 16);
      },
    });
  }

  // Method to start fetching and processing blocks from the network
  async start(startBlock: number): Promise<void> {
    let block: number = await this.getOrCreateBlockFile(startBlock);

    while (true) {
      await this.processBlock(block);

      const lastBlock = await this.client.getBlockNumber();
      if (block === Number(lastBlock)) break;
      block++;
      await writeFile('lastBlock.txt', block.toString());
    }
  }

  async processBlock(block: number): Promise<void> {
    const { txns, createdAt } = await this.getBlockTransactions(block);
    Logger.debug('Processing Block', `${block} -- ${this.howLongAgo(createdAt.toString())}`);
    await this.processTransactions(txns, createdAt);
  }

  // Method to add transactions to the database
  async processTransactions(txns: `0x${string}`[], createdAt: Date) {
    for (let i = 0; i < txns.length; i++) {
      const hash = txns[i];

      try {
        // Get the transaction
        const transaction = await this.client.getTransaction({ hash });
        // Get the data from the transaction
        const stringData = hexToString(transaction.input.toString() as `0x${string}`);
        // Remove null bytes from the string
        const cleanedString = stringData.replace(/\x00/g, '');
        // Check if the string starts with 'data:'
        const possibleEthPhunk = cleanedString.startsWith('data:image/svg+xml,');

        // Logger.debug('Processing transaction', transaction.hash);
        if (possibleEthPhunk) {
          Logger.debug('Processing transaction', transaction.hash);
          await this.sbSvc.processEthscriptionEvent(transaction, createdAt, cleanedString);
        }

        const possibleTransfer = transaction.input.substring(2).length === 64;
        if (possibleTransfer) {
          Logger.debug('Processing transfer', transaction.hash);
          await this.sbSvc.processTransferEvent(transaction);
        }

      } catch (error) {
        Logger.error(error.shortMessage || error, 'processTransactions()', hash);
        i = i - 1;
      }
    }
  }

  // Method to get transactions from a specific block
  async getBlockTransactions(n: number): Promise<{
    txns: `0x${string}`[],
    createdAt: Date
  }> {
    const block = await this.client.getBlock({ blockNumber: BigInt(n) });

    const ts = Number(block.timestamp);
    const createdAt = new Date(ts * 1000);
    const txns = block.transactions as `0x${string}`[];

    return { txns, createdAt };
  }

  async getTransactionFromHash(hash: `0x${string}`) {
    try {
      return await this.client.getTransaction({ hash });
    } catch (error) {
      return null;
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // PUNK DATA /////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async getPunkImage(tokenId: number): Promise<any> {
    const punkImage = await this.client?.readContract({
      address: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2' as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkImageSvg',
      args: [`${tokenId}`],
    });
    return punkImage as any;
  }

  howLongAgo(timestamp: string): string {
    const now: Date = new Date();
    const past: Date = new Date(timestamp);
    const differenceInMilliseconds: number = now.getTime() - past.getTime();

    const differenceInSeconds: number = Math.floor(differenceInMilliseconds / 1000);
    const differenceInMinutes: number = Math.floor(differenceInSeconds / 60);
    const differenceInHours: number = Math.floor(differenceInMinutes / 60);
    const differenceInDays: number = Math.floor(differenceInHours / 24);

    const remainingHours: number = differenceInHours % 24;
    const remainingMinutes: number = differenceInMinutes % 60;
    const remainingSeconds: number = differenceInSeconds % 60;
    const remainingMilliseconds: number = differenceInMilliseconds % 1000;

    let result: string = '';

    if (differenceInDays > 0) {
        result += differenceInDays + 'day ';
    }
    if (remainingHours > 0 || differenceInDays > 0) {
        result += remainingHours + 'hr ';
    }
    if (remainingMinutes > 0 || remainingHours > 0 || differenceInDays > 0) {
        result += remainingMinutes + 'min ';
    }
    if (remainingSeconds > 0 || remainingMinutes > 0 || remainingHours > 0 || differenceInDays > 0) {
        result += remainingSeconds + 'sec ';
    }
    // result += remainingMilliseconds + ' millisecond(s) ago';

    return result;
  }

  async getOrCreateBlockFile(block: number) {
    try {
      const blockFromFile = await readFile('lastBlock.txt', 'utf8');
      if (!blockFromFile) await writeFile('lastBlock.txt', block.toString());
      if (blockFromFile) block = Number(blockFromFile.toString());
      return block;
    } catch (err) {
      Logger.error(err.message);
      return block;
    }
  }

}
