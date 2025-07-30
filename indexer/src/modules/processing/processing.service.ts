import { Inject, Injectable, Logger } from '@nestjs/common';

import { Web3Service } from '@/modules/shared/services/web3.service';
import { StorageService } from '@/modules/storage/storage.service';
import { TelegramService } from '@/modules/notifs/services/telegram.service';

import { UtilityService } from '@/modules/shared/services/utility.service';
import { TimeService } from '@/modules/shared/services/time.service';
import { EthscriptionsService } from '@/modules/ethscriptions/ethscriptions.service';
import { CommentsService } from '@/modules/comments/comments.service';
import { MarketplaceService } from '@/modules/marketplace/marketplace.service';
import { PointsService } from '@/modules/points/points.service';
import { AuctionsService } from '@/modules/auctions/auctions.service';

import { Event } from '@/modules/storage/models/db';

import { FormattedTransaction, GetBlockReturnType, Transaction, TransactionReceipt } from 'viem';

const CONFIRMATIONS = 6;
const BLOCK_HISTORY = 30;

interface ProcessedBlock {
  number: number,
  hash: `0x${string}`,
  parentHash: `0x${string}`,
  confirmed: boolean,
};

@Injectable()
export class ProcessingService {

  processedBlocks: Array<ProcessedBlock> = [];

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    private readonly storageSvc: StorageService,
    private readonly utilSvc: UtilityService,
    private readonly timeSvc: TimeService,
    private readonly ethsSvc: EthscriptionsService,
    private readonly commentsSvc: CommentsService,
    private readonly marketplaceSvc: MarketplaceService,
    private readonly auctionsSvc: AuctionsService,
    private readonly pointsSvc: PointsService,
    private readonly telegramSvc: TelegramService
  ) {}

  /**
   * Processes a block by retrieving its transactions, processing them, and adding the events to the database.
   * Optionally, updates the last block in the database.
   *
   * @param blockNum - The number of the block to process.
   * @param updateBlockDb - Whether to update the last block in the database. Default is true.
   * @returns A Promise that resolves when the block processing is complete.
   */
  async processBlock(n: number, updateBlockDb = true): Promise<void> {

    const block = await this.web3SvcL1.getBlock({ blockNumber: n, includeTransactions: true });
    const { number, hash, parentHash, timestamp, transactions } = block;

    if (n !== Number(number)) throw new Error(`Block number mismatch: ${n} !== ${number}`);

    const blockNumber = Number(number);
    const createdAt = new Date(Number(timestamp) * 1000);

    // Check for reorgs
    // await this.checkForReorg(block);

    // Log the block
    const timeAgo = this.timeSvc.howLongAgo(createdAt as any);
    Logger.log(
      `Processing block ${blockNumber} (L1)`,
      `${timeAgo.trim()}`
    );

    // Process the transactions & get the events
    const events = await this.processTransactions(transactions, createdAt);

    // Add the events to the database
    if (events.length) await this.storageSvc.addEvents(events);
    // Update the block in db
    if (updateBlockDb) {
      this.storageSvc.updateLastBlock(blockNumber, createdAt);
      // this.telegramSvc.sendMessage('Status:', `Processed block ${blockNumber} (L1)`);
    }

    // Add the block to the processed blocks
    this.processedBlocks.push({ number: blockNumber, hash, parentHash, confirmed: false });
    if (this.processedBlocks.length > BLOCK_HISTORY) this.processedBlocks.shift();
  }

  /**
   * Retries processing a block if an error occurs.
   * @param blockNumber - The block number to retry.
   * @returns A Promise that resolves when the block processing is complete.
   */
  async retryBlock(blockNumber: number): Promise<void> {
    try {
      Logger.debug(`Retrying block ${blockNumber}`);

      // Pause for 5 seconds
      await this.utilSvc.delay(5000);

      // Get the transactions from the block
      const { timestamp, transactions } = await this.web3SvcL1.getBlock({ blockNumber, includeTransactions: true });
      const createdAt = new Date(Number(timestamp) * 1000);

      const events = await this.processTransactions(transactions, createdAt);
      if (events.length) await this.storageSvc.addEvents(events);
    } catch (error) {
      console.log(error);
      // Pause for 5 seconds
      await this.utilSvc.delay(5000);
      // Retry the block
      return this.retryBlock(blockNumber);
    }
  }

  /**
   * Processes an array of transactions and their receipts.
   * Sorts the transactions by transaction index and processes each transaction.
   * If an error occurs during processing, it logs the error, sends a message, and retries the block.
   * @param txns - An array of transactions and their receipts.
   * @param createdAt - The date when the transactions were created.
   * @returns An array of events generated from the processed transactions.
   */
  async processTransactions(
    txns: { transaction: FormattedTransaction; receipt: TransactionReceipt; }[],
    createdAt: Date
  ): Promise<Event[]> {

    txns = txns.filter((txn) => txn.transaction.input !== '0x');

    // Sort by transaction index
    txns = txns.sort((a, b) => a.receipt.transactionIndex - b.receipt.transactionIndex);

    let events: Event[] = [];

    for (let i = 0; i < txns.length; i++) {
      const transaction = txns[i].transaction as Transaction;
      const receipt = txns[i].receipt as TransactionReceipt;

      try {
        const transactionEvents = await this.processTransaction(transaction, receipt, createdAt);
        if (transactionEvents?.length) events.push(...transactionEvents);
      } catch (error) {
        console.log(error);
        await this.retryBlock(Number(transaction.blockNumber));
      }
    }
    return events;
  }

  /**
   * Processes a transaction and returns an array of events.
   *
   * @param transaction - The transaction object to process.
   * @param receipt - The transaction receipt object.
   * @param createdAt - The date when the transaction was created.
   * @returns A promise that resolves to an array of events.
   */
  async processTransaction(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date
  ): Promise<Event[]> {

    // Skip any transaction that failed
    if (receipt.status !== 'success') return [];

    const events: Event[] = [];

    // Process ethscriptions
    const ethscriptionsEvents = await this.ethsSvc.processEthscriptionsEvents(
      transaction,
      receipt,
      createdAt
    );
    if (ethscriptionsEvents?.length) events.push(...ethscriptionsEvents);

    // Process marketplace events
    const marketplaceEvents = await this.marketplaceSvc.processEtherPhunkMarketplaceEvents(
      transaction,
      receipt,
      createdAt
    );
    if (marketplaceEvents?.length) events.push(...marketplaceEvents);

    // Process auction events
    const auctionEvents = await this.auctionsSvc.processEtherPhunkAuctionEvents(
      transaction,
      receipt,
      createdAt
    );
    if (auctionEvents?.length) events.push(...auctionEvents);

    // Process points events
    await this.pointsSvc.processPointsEvents(receipt);

    // Process comments
    await this.commentsSvc.processComments(
      transaction,
      createdAt
    );

    // const bridgeMainnetLogs = receipt.logs.filter(
    //   (log: any) => log.address.toLowerCase() === bridgeAddressL1.toLowerCase()
    // );
    // if (bridgeMainnetLogs.length) {
    //   Logger.debug(
    //     `Processing Points event (${chain})`,
    //     transaction.hash
    //   );
    //   await this.processBridgeMainnetEvents(bridgeMainnetLogs);
    //   return events;
    // }

    // Process nft events
    // const nftEvents = await this.nftSvc.processNftEvents(
    //   transaction,
    //   receipt,
    //   createdAt
    // );
    // if (nftEvents?.length) events.push(...nftEvents);

    return events;
  }

  /**
   * Processes a single transaction.
   * @param hash - The hash of the transaction to process.
   */
  async processSingleTransaction(hash: `0x${string}`) {
    const txn = await this.web3SvcL1.getTransaction(hash);
    const receipt = await this.web3SvcL1.getTransactionReceipt(hash);

    const block = await this.web3SvcL1.getBlock({ blockNumber: Number(txn.blockNumber) });
    const createdAt = new Date(Number(block.timestamp) * 1000);

    // Process the transactions & get the events
    const events = await this.processTransactions([{ transaction: txn, receipt }], createdAt);
    // Add the events to the database
    if (events.length) await this.storageSvc.addEvents(events);
  }

  /**
   * Checks for reorganization in the blockchain by comparing the parent hash of the given block
   * with the hash of the last processed block. If a reorg is detected, an error is thrown.
   * Also marks the block at CONFIRMATIONS distance from the last processed block as confirmed.
   * @param block - The block to check for reorg.
   * @throws Error if a reorg is detected at the given block.
   */
  async checkForReorg(block: GetBlockReturnType<any, any>) {
    const { number, parentHash } = block;

    const blockNumber = Number(number);
    if (this.processedBlocks.length > 0) {
      const lastProcessedBlock = this.processedBlocks[this.processedBlocks.length - 1];

      if (lastProcessedBlock.hash !== parentHash) {
        throw new Error(`Reorg detected at block ${blockNumber}`);
      }

      if (this.processedBlocks[this.processedBlocks.length - CONFIRMATIONS]) {
        this.processedBlocks[this.processedBlocks.length - CONFIRMATIONS].confirmed = true;
      }
    }
  }
}
