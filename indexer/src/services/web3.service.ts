import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from './supabase.service';

import { FormattedTransaction, Transaction, createPublicClient, decodeEventLog, hexToString, http } from 'viem';
import { mainnet } from 'viem/chains';

import { readFile, writeFile } from 'fs/promises';

import { TransferEthscriptionSignature } from 'src/constants/EthscriptionsProtocol';

import punkDataABI from '../abi/PunkData.json';
import { esip1Abi } from 'src/abi/EthscriptionsProtocol';

import dotenv from 'dotenv';
dotenv.config();

const rpcURL: string = process.env.RPC_URL_MAINNET;
const client = createPublicClient({ chain: mainnet, transport: http(rpcURL) });

@Injectable()
export class Web3Service {

  lastBlock: number = 0;

  constructor(
    private readonly sbSvc: SupabaseService
  ) {}

  // Method to start fetching and processing blocks from the network
  async startBackfill(startBlock: number): Promise<void> {
    let block: number = await this.getOrCreateBlockFile(startBlock);

    while (block < 17764910) {
      await this.processBlock(block);
      await this.saveBlockNumber(block);
      block++;
    }
  }

  async startPolling(): Promise<void> {
    client.watchBlocks({
      onBlock: async (block) => {
        const blockNum = Number(block.number) - 16;
        await this.processBlock(blockNum);
        await this.saveBlockNumber(blockNum);
      },
    });
  }

  async saveBlockNumber(block: number): Promise<void> {
    return await writeFile(`lastBlock.txt`, block.toString());
  }

  async processBlock(block: number): Promise<void> {
    const { txns, createdAt } = await this.getBlockTransactions(block);
    Logger.debug('Processing Block', `${block} -- ${this.howLongAgo(createdAt.toString())}`);
    await this.processTransactions(txns, createdAt);
  }

  // Method to add transactions to the database
  async processTransactions(txns: FormattedTransaction[], createdAt: Date) {

    // Filter empty transactions and sort by transaction index
    txns = txns.filter((txn) => txn.input !== '0x').sort((a, b) => a.transactionIndex - b.transactionIndex);

    for (let i = 0; i < txns.length; i++) {

      const transaction = txns[i];
      const { hash } = transaction;

      try {

        // DISABLED: All 10,000 have been ethscribed
        // Check if possible ethPhunk
        // const { possibleEthPhunk, cleanedString } = this.possibleEthPhunk(transaction.input);
        // if (possibleEthPhunk) {
        //   Logger.debug('Processing ethscription', transaction.hash);
        //   await this.sbSvc.processEthscriptionEvent(transaction as Transaction, createdAt, cleanedString);
        //   continue;
        // }

        // Check if possible transfer
        const possibleTransfer = transaction.input.substring(2).length === 64;
        if (possibleTransfer) {
          Logger.debug('Processing transfer', transaction.hash);
          await this.sbSvc.processTransferEvent(transaction as Transaction, createdAt);
          continue;
        }

        // Check if possible marketplace event
        const receipt = await client.getTransactionReceipt({ hash });
        const ethscriptionTransfers = receipt.logs.filter((log: any) => {
          return log.topics[0] === TransferEthscriptionSignature;
        });

        // Continue if no ethscription transfers
        if (!ethscriptionTransfers.length) continue;

        for (const log of ethscriptionTransfers) {
          const decoded = decodeEventLog({
            abi: esip1Abi,
            data: log.data,
            topics: log.topics
          });

          const sender = log.address;
          const recipient = decoded.args['recipient'];
          const ethscriptionId = decoded.args['ethscriptionId'];

          Logger.debug('Processing marketplace event', transaction.hash);
          await this.sbSvc.processMarketplaceEvent(
            transaction as Transaction,
            createdAt,
            sender,
            recipient,
            ethscriptionId
          );
        }

      } catch (error) {
        Logger.error(error.shortMessage || error, 'processTransactions()', hash);
        i = i - 1;
      }
    }
  }

  // Method to get transactions from a specific block
  async getBlockTransactions(n: number): Promise<{ txns: FormattedTransaction[], createdAt: Date }> {
    const block = await client.getBlock({ includeTransactions: true, blockNumber: BigInt(n) });

    const ts = Number(block.timestamp);
    const createdAt = new Date(ts * 1000);
    const txns = block.transactions;

    return { txns, createdAt };
  }

  // async getTransactionFromHash(hash: `0x${string}`) {
  //   try {
  //     return await client.getTransaction({ hash });
  //   } catch (error) {
  //     return null;
  //   }
  // }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // PUNK DATA /////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async getOrCreateBlockFile(block: number) {
    try {
      const blockFromFile = await readFile(`lastBlock.txt`, 'utf8');
      if (!blockFromFile) await writeFile(`lastBlock.txt`, block.toString());
      if (blockFromFile) block = Number(blockFromFile.toString());

      const lastBlock = await client.getBlockNumber();
      this.lastBlock = Number(lastBlock);

      return block;
    } catch (err) {
      Logger.error(err.message);
      return block;
    }
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

    return result;
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Punk data contract interactions ////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  possibleEthPhunk(input: string): { possibleEthPhunk: boolean, cleanedString: string } {
    // Get the data from the transaction
    const stringData = hexToString(input.toString() as `0x${string}`);
    // Remove null bytes from the string
    const cleanedString = stringData.replace(/\x00/g, '');
    // Check if the string starts with 'data:'
    const possibleEthPhunk = cleanedString.startsWith('data:image/svg+xml,');

    return { possibleEthPhunk, cleanedString }
  }

  async getPunkImage(tokenId: number): Promise<any> {
    const punkImage = await client?.readContract({
      address: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2' as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkImageSvg',
      args: [`${tokenId}`],
    });
    return punkImage as any;
  }

  async getPunkAttributes(tokenId: number): Promise<any> {
    const punkAttributes = await client?.readContract({
      address: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2' as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkAttributes',
      args: [`${tokenId}`],
    });
    return punkAttributes as any;
  }
}
