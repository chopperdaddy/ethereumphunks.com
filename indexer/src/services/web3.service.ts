import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from './supabase.service';
import { TimeService } from './time.service';

import { FormattedTransaction, Log, Transaction, TransactionType, createPublicClient, decodeEventLog, hexToString, http } from 'viem';
import { goerli, mainnet } from 'viem/chains';

import { readFile, writeFile } from 'fs/promises';

import { TransferEthscriptionForPreviousOwnerSignature, TransferEthscriptionSignature } from 'src/constants/EthscriptionsProtocol';

import punkDataABI from '../abi/PunkData.json';
import { esip1Abi, esip2Abi } from 'src/abi/EthscriptionsProtocol';

import dotenv from 'dotenv';
import { etherPhunksMarketAbi } from 'src/abi/EtherPhunksMarket';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
const rpcURL: string = chain === 'goerli' ? process.env.RPC_URL_GOERLI : process.env.RPC_URL_MAINNET;
const client = createPublicClient({
  chain: chain === 'goerli' ? goerli : mainnet,
  transport: http(rpcURL)
});

const marketAddress = '0xAeC64fe68B8b12A501DDCE30d022fead68948db0'.toLowerCase();

@Injectable()
export class Web3Service {

  startTime: Date;
  lastBlock: number = 0;

  constructor(
    private readonly sbSvc: SupabaseService,
    private readonly timeService: TimeService
  ) {}

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
    blockDelay = blockDelay || 16;
    client.watchBlocks({
      onBlock: async (block) => {
        const blockNum = Number(block.number) - blockDelay;
        await this.processBlock(blockNum);
        await this.saveBlockNumber(blockNum);
      },
    });
  }

  async saveBlockNumber(block: number): Promise<void> {
    return await writeFile(`lastBlock-${chain}.txt`, block.toString());
  }

  async processBlock(block: number): Promise<void> {
    const { txns, createdAt } = await this.getBlockTransactions(block);
    await this.processTransactions(txns, createdAt);

    // Log block processed
    this.timeService.logBlockProcessed();
    const timeSince = this.timeService.howLongAgo(createdAt.toString());
    const timeRemaining = this.timeService.getTimeRemainingEstimate(block, this.lastBlock);

    // Set last block to current block if it is a multiple of 16
    if (block % 16 === 0) this.lastBlock = Number(await client.getBlockNumber());

    // Log block processed
    if (block % 100 === 0) Logger.verbose(`Time Remaining: ${timeRemaining} (${chain})`);
    Logger.debug(`Block Timestamp: ${timeSince}`, `Processing Block ${block} (${chain})`);
  }

  // Method to add transactions to the database
  async processTransactions(txns: FormattedTransaction[], createdAt: Date) {
    // Filter empty transactions and sort by transaction index
    txns = txns
      .filter((txn) => txn.input !== '0x')
      .sort((a, b) => a.transactionIndex - b.transactionIndex);

    for (let i = 0; i < txns.length; i++) {
      const transaction = txns[i] as Transaction;
      const { hash } = transaction;

      try {
        // DISABLED: All 10,000 have been ethscribed
        // Check if possible ethPhunk
        const { possibleEthPhunk, cleanedString } = this.possibleEthPhunk(transaction.input);
        if (possibleEthPhunk) {
          Logger.debug('Processing ethscription', transaction.hash);
          await this.sbSvc.processEthscriptionEvent(transaction as Transaction, createdAt, cleanedString);
          continue;
        }

        // Check if possible transfer
        const possibleTransfer = transaction.input.substring(2).length === 64;
        if (possibleTransfer) {
          Logger.debug(`Processing transfer (${chain})`, transaction.hash);
          await this.sbSvc.processTransferEvent(
            transaction as Transaction,
            createdAt
          );
          continue;
        }

        // Check if possible marketplace event
        const receipt = await client.getTransactionReceipt({ hash });

        // Filter logs for ethscription transfers (esip1)
        const esip1Transfers = receipt.logs.filter(
          (log: any) => log.topics[0] === TransferEthscriptionSignature
        );
        if (esip1Transfers.length) {
          Logger.debug(
            `Processing marketplace event (esip1) (${chain})`,
            transaction.hash
          );
          await this.processEsip1(esip1Transfers, transaction, createdAt);
          continue;
        }

        // Filter logs for ethscription transfers (esip2)
        const esip2Transfers = receipt.logs.filter(
          (log: any) => log.topics[0] === TransferEthscriptionForPreviousOwnerSignature
        );
        if (esip2Transfers.length) {
          Logger.debug(
            `Processing marketplace event (esip2) (${chain})`,
            transaction.hash
          );
          await this.processEsip2(esip2Transfers, transaction, createdAt);
        }

        // Filter logs for EtherPhunk Marketplace events
        const marketplaceLogs = receipt.logs.filter(
          (log: any) => log.address === marketAddress
        );
        if (marketplaceLogs.length) {
          await this.processMarketplaceEvents(marketplaceLogs, transaction, createdAt);
        }

      } catch (error) {
        Logger.error(
          error.shortMessage || error,
          'processTransactions()',
          hash
        );
        i = i - 1;
      }
    }
  }

  async processEsip1(
    ethscriptionTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<void> {
    for (const log of ethscriptionTransfers) {
      const decoded = decodeEventLog({
        abi: esip1Abi,
        data: log.data,
        topics: log.topics,
      });

      const sender = log.address;
      const recipient = decoded.args['recipient'];
      const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

      await this.sbSvc.processContractEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        transaction.value,
        null,
        log
      );
    }
  }

  async processEsip2(
    previousOwnerTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<void> {
    for (const log of previousOwnerTransfers) {
      const decoded = decodeEventLog({
        abi: esip2Abi,
        data: log.data,
        topics: log.topics,
      });

      const sender = log.address;
      const prevOwner = decoded.args['previousOwner'];
      const recipient = decoded.args['recipient'];
      const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

      await this.sbSvc.processContractEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        transaction.value,
        prevOwner,
        log
      );
    }
  }

  async processMarketplaceEvents(
    marketplaceLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<void> {
    for (const log of marketplaceLogs) {

      if (log.address.toLowerCase() !== marketAddress) continue;

      const decoded = decodeEventLog({
        abi: etherPhunksMarketAbi,
        data: log.data,
        topics: log.topics,
      });

      await this.sbSvc.processMarketplaceEvent(
        transaction,
        createdAt,
        decoded,
      );
    }
  }

  // Method to get transactions from a specific block
  async getBlockTransactions(
    n: number
  ): Promise<{ txns: FormattedTransaction[]; createdAt: Date }> {
    const block = await client.getBlock({
      includeTransactions: true,
      blockNumber: BigInt(n),
    });

    const ts = Number(block.timestamp);
    const createdAt = new Date(ts * 1000);
    const txns = block.transactions;

    return { txns, createdAt };
  }

  async getTransaction(hash: `0x${string}`): Promise<any> {
    const transaction = await client.getTransaction({ hash });
    return transaction;
  }

  async getTransactionReceipt(hash: `0x${string}`): Promise<any> {
    const receipt = await client.getTransactionReceipt({ hash });
    return receipt;
  }

  possibleEthPhunk(input: string): {
    possibleEthPhunk: boolean;
    cleanedString: string;
  } {
    // Get the data from the transaction
    const stringData = hexToString(input.toString() as `0x${string}`);
    // Remove null bytes from the string
    const cleanedString = stringData.replace(/\x00/g, '');
    // Check if the string starts with 'data:'
    const possibleEthPhunk = cleanedString.startsWith('data:image/svg+xml,');

    return { possibleEthPhunk, cleanedString };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // PUNK DATA /////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async getOrCreateBlockFile(block: number) {
    try {
      const blockFromFile = await readFile(`lastBlock-${chain}.txt`, 'utf8');
      if (!blockFromFile) await writeFile(`lastBlock-${chain}.txt`, block.toString());
      if (blockFromFile) block = Number(blockFromFile.toString());

      const lastBlock = await client.getBlockNumber();
      this.lastBlock = Number(lastBlock);

      return block;
    } catch (err) {
      Logger.error(err.message);
      return block;
    }
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Punk data contract interactions ////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

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
