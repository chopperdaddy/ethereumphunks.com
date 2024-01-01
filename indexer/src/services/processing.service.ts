import { Injectable, Logger } from '@nestjs/common';

import { BlockService } from 'src/modules/queue/services/block.service';

import { Web3Service } from './web3.service';
import { SupabaseService } from './supabase.service';
import { DataService } from './data.service';

import { UtilityService } from 'src/utils/utility.service';
import { TimeService } from 'src/utils/time.service';

import { esip1Abi, esip2Abi } from 'src/abi/EthscriptionsProtocol';

import etherPhunksMarketProxyAbi from 'src/abi/EtherPhunksMarketProxy.json';
import pointsAbi from 'src/abi/Points.json';
import etherPhunksAuctionHouseAbi from 'src/abi/EtherPhunksAuctionHouse.json';

import * as esips from 'src/constants/EthscriptionsProtocol';

import { Ethscription, Event, PhunkSha } from 'src/models/db';

import { DecodeEventLogReturnType, FormattedTransaction, Log, Transaction, TransactionReceipt, decodeEventLog, zeroAddress } from 'viem';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SEGMENT_SIZE = 64;

@Injectable()
export class ProcessingService {

  startTime: Date;

  constructor(
    private readonly blockSvc: BlockService,
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService,
    private readonly utilSvc: UtilityService,
    private readonly timeSvc: TimeService,
    private readonly dataSvc: DataService,
  ) {}

  // Method to start fetching and processing blocks from the network
  async startBackfill(startBlock: number): Promise<void> {
    const latestBlock = await this.web3Svc.getBlock();
    const latestBlockNum = Number(latestBlock.number);

    while (startBlock < latestBlockNum) {
      await this.addBlockToQueue(startBlock, new Date().getTime());
      startBlock++;
    }
  }

  async startPolling(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Watch for new blocks and add them to the queue
      const unwatch = this.web3Svc.client.watchBlocks({
        onBlock: async (block) => {
          try {
            const blockNum = Number(block.number);
            const timestamp = new Date(Number(block.timestamp) * 1000).getTime();
            await this.addBlockToQueue(blockNum, timestamp);
          } catch (error) {
            unwatch();
            reject(error); // Reject the promise on error
          }
        },
        onError: (error) => {
          console.log(error);
          unwatch(); // Unwatch the blocks
          reject(error); // Reject the promise on error
        }
      });
    });
  }

  async processBlock(blockNum: number): Promise<void> {
    const { txns, createdAt } = await this.web3Svc.getBlockTransactions(blockNum);

    // Log the block
    const timeAgo = this.timeSvc.howLongAgo(createdAt as any);
    Logger.log(`Processing block ${blockNum} (${this.web3Svc.chain}) ➖  ${timeAgo}`);

    // Process the transactions
    const events = await this.processTransactions(txns, createdAt);

    // Add the events to the database
    if (events.length) await this.sbSvc.addEvents(events);

    // Update the block in db
    if (blockNum % 10 === 0) this.sbSvc.updateLastBlock(blockNum, createdAt);
  }

  async retryBlock(blockNum: number): Promise<void> {
    try {
      Logger.debug(`Retrying block ${blockNum} (${this.web3Svc.chain})`);
      await this.utilSvc.delay(5000);
      // Get the transactions from the block
      const { txns, createdAt } = await this.web3Svc.getBlockTransactions(blockNum);
      await this.processTransactions(txns, createdAt);
    } catch (error) {
      console.log(error);
      // Pause for 10 seconds
      await this.utilSvc.delay(5000);
      // Retry the block
      return this.retryBlock(blockNum);
    }
  }

  async addBlockToQueue(blockNum: number, blockTimestamp: number): Promise<void> {
    await this.blockSvc.addBlockToQueue(blockNum, blockTimestamp);
  }

  // Method to add transactions to the database
  async processTransactions(
    txns: { transaction: FormattedTransaction; receipt: TransactionReceipt; }[],
    createdAt: Date
  ): Promise<Event[]> {
    // Sort by transaction index
    txns = txns.sort((a, b) => a.receipt.transactionIndex - b.receipt.transactionIndex);

    let events: Event[] = [];

    for (let i = 0; i < txns.length; i++) {
      const transaction = txns[i].transaction as Transaction;
      const receipt = txns[i].receipt as TransactionReceipt;

      const { input } = transaction;

      // Skip any transaction with no input
      // Skip any transaction that failed
      if (receipt.status !== 'success') continue;

      // Get the data from the transaction
      // Remove null bytes from the string
      // const stringData = hexToString(input.toString() as `0x${string}`);
      // const cleanedString = stringData.replace(/\x00/g, '');

      // DISABLED: All 10,000 have been ethscribed
      // Check if possible ethPhunk creation
      // const possibleEthPhunk = cleanedString.startsWith('data:image/svg+xml,');
      // if (possibleEthPhunk) {
      //   const sha = crypto.createHash('sha256').update(cleanedString).digest('hex');

      //   // Check if the sha exists in the phunks sha table
      //   const phunkSha = await this.sbSvc.checkIsEthPhunk(sha);
      //   if (!phunkSha) continue;

      //   // Check if its a duplicate (already been inscribed)
      //   const isDuplicate = await this.sbSvc.checkEthscriptionExistsBySha(sha);
      //   if (isDuplicate) continue;

      //   Logger.debug('Processing ethscription', transaction.hash);
      //   const event = await this.processEtherPhunkCreationEvent(transaction as Transaction, createdAt, phunkSha);
      //   events.push(event);
      //   continue;
      // }

      // Check if possible transfer
      const possibleTransfer = input.substring(2).length === SEGMENT_SIZE;
      if (possibleTransfer) {
        Logger.debug(`Processing transfer (${this.web3Svc.chain})`, transaction.hash);
        const event = await this.processTransferEvent(
          input,
          transaction as Transaction,
          createdAt
        );
        if (event) events.push(event);
      }

      // Check if possible batch transfer
      const possibleBatchTransfer = input.substring(2).length % SEGMENT_SIZE === 0;
      if (!possibleTransfer && possibleBatchTransfer) {
        const eventArr = await this.processEsip5(
          transaction as Transaction,
          createdAt
        );
        if (eventArr?.length) events.push(...eventArr);
      }

      // Filter logs for ethscription transfers (esip1)
      const esip1Transfers = receipt.logs.filter(
        (log: any) => log.topics[0] === esips.TransferEthscriptionSignature
      );
      if (esip1Transfers.length) {
        Logger.debug(
          `Processing marketplace event (esip1) (${this.web3Svc.chain})`,
          transaction.hash
        );
        const eventArr = await this.processEsip1(
          esip1Transfers,
          transaction,
          createdAt
        );
        if (eventArr?.length) events.push(...eventArr);
      }

      // Filter logs for ethscription transfers (esip2)
      const esip2Transfers = receipt.logs.filter(
        (log: any) => log.topics[0] === esips.TransferEthscriptionForPreviousOwnerSignature
      );
      if (esip2Transfers.length) {
        Logger.debug(
          `Processing marketplace event (esip2) (${this.web3Svc.chain})`,
          transaction.hash
        );
        const eventArr = await this.processEsip2(esip2Transfers, transaction, createdAt);
        if (eventArr?.length) events.push(...eventArr);
      }

      // Filter logs for EtherPhunk Marketplace events
      const marketplaceLogs = receipt.logs.filter(
        (log: any) => this.web3Svc.marketAddress.filter(
          (addr) => addr.toLowerCase() === log.address.toLowerCase()
        )?.length
      );
      if (marketplaceLogs.length) {
        Logger.debug(
          `Processing EtherPhunk Marketplace event (${this.web3Svc.chain})`,
          transaction.hash
        );
        const eventArr = await this.processEtherPhunkMarketplaceEvents(
          marketplaceLogs,
          transaction,
          createdAt
        );
        if (eventArr?.length) events.push(...eventArr);
      }

      const pointsLogs = receipt.logs.filter(
        (log: any) => this.web3Svc.pointsAddress.toLowerCase() === log.address.toLowerCase()
      );
      if (pointsLogs.length) {
        Logger.debug(
          `Processing Points event (${this.web3Svc.chain})`,
          transaction.hash
        );
        await this.processPointsEvent(pointsLogs);
      }

      // Filter logs for EtherPhunk Auction House Events
      // const auctionHouseLogs = receipt.logs.filter(
      //   (log: any) => log.address === this.web3Svc.auctionAddress
      // );
      // if (auctionHouseLogs.length) {
      //   Logger.debug(
      //     `Processing EtherPhunk Auction House event (${this.web3Svc.chain})`,
      //     transaction.hash
      //   );
      //   await this.processAuctionHouseEvents(auctionHouseLogs, transaction, createdAt);
      // }
    }
    return events;
  }

  async processEtherPhunkCreationEvent(
    txn: Transaction,
    createdAt: Date,
    phunkShaData: PhunkSha
  ): Promise<Event> {
    const { from, to, hash: hashId } = txn;

    // Add the ethereum phunk
    await this.sbSvc.addEthPhunk(txn, createdAt, phunkShaData);
    Logger.log('Added eth phunk', `${hashId.toLowerCase()}`);

    return {
      txId: txn.hash + txn.transactionIndex,
      type: 'created',
      hashId,
      from,
      to: to || zeroAddress,
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: BigInt(0).toString(),
    };
  }

  async processPointsEvent(pointsLogs: any[]): Promise<void> {
    for (const log of pointsLogs) {
      const decoded = decodeEventLog({
        abi: pointsAbi,
        data: log.data,
        topics: log.topics,
      });

      const { eventName } = decoded;
      const { args } = decoded as any;

      if (!eventName || !args) return;
      if (eventName === 'PointsAdded') {
        const { user, amount } = args;
        await this.distributePoints(user);
      }
    }
  }

  async distributePoints(fromAddress: `0x${string}`): Promise<void> {
    try {
      const points = await this.web3Svc.getPoints(fromAddress);
      await this.sbSvc.updateUserPoints(fromAddress, Number(points));
      Logger.log(`Updated user points to ${points}`, fromAddress);
    } catch (error) {
      console.log(error);
    }
  }

  async processTransferEvent(
    hashId: string,
    txn: Transaction,
    createdAt: Date,
    index?: number
  ): Promise<Event | null> {
    const ethscript: Ethscription = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);
    if (!ethscript) return null;

    const { from, to } = txn;
    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === txn.from.toLowerCase();

    if (!isMatchedHashId || !transferrerIsOwner) return null;

    // Update the eth phunk owner
    await this.sbSvc.updateEthscriptionOwner(hashId, ethscript.owner, txn.to);
    Logger.log('Updated ethscript owner (contract event)', `Hash: ${ethscript.hashId} -- To: ${to.toLowerCase()}`);

    // console.log({
    //   type: 'transfer',
    //   transactionIndex: txn.transactionIndex,
    //   txId: txn.hash + new Date().getTime(),
    // });

    return {
      txId: txn.hash + (index || txn.transactionIndex),
      type: 'transfer',
      hashId: ethscript.hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: txn.value.toString(),
    };
  }

  async processContractTransferEvent(
    txn: Transaction,
    createdAt: Date,
    from: string,
    to: string,
    hashId: string,
    log: Log,
    value?: bigint,
    prevOwner?: string,
  ): Promise<Event | null> {
    const ethscript: Ethscription = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);
    if (!ethscript) return null;

    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === from.toLowerCase();

    const samePrevOwner = (ethscript.prevOwner && prevOwner)
      ? ethscript.prevOwner.toLowerCase() === prevOwner.toLowerCase()
      : true;

    if (!isMatchedHashId || !transferrerIsOwner || !samePrevOwner) return null;

    // Update the eth phunk owner
    await this.sbSvc.updateEthscriptionOwner(ethscript.hashId, ethscript.owner, to);
    Logger.log('Updated ethscript owner (contract event)', `Hash: ${ethscript.hashId} -- To: ${to.toLowerCase()}`);

    // console.log({
    //   type: 'contract transfer',
    //   txId: txn.hash + (log?.logIndex || txn.transactionIndex || new Date().getTime()),
    // });

    return {
      txId: txn.hash + (log?.logIndex || txn.transactionIndex || new Date().getTime()),
      type: 'transfer',
      hashId: ethscript.hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: value?.toString(),
    };
  }

  async processEsip1(
    ethscriptionTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of ethscriptionTransfers) {
      const decoded = decodeEventLog({
        abi: esip1Abi,
        data: log.data,
        topics: log.topics,
      });

      const sender = log.address;
      const recipient = decoded.args['recipient'];
      const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

      const event = await this.processContractTransferEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        log,
        transaction.value,
        null,
      );
      if (event) events.push(event);
    }

    return events;
  }

  async processEsip2(
    previousOwnerTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
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

      const event = await this.processContractTransferEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        log,
        transaction.value,
        prevOwner
      );

      if (event) events.push(event);
    }

    return events;
  }

  async processEsip5(
    txn: Transaction,
    createdAt: Date
  ): Promise<Event[]> {
    const { input } = txn;
    const data = input.substring(2);
    if (data.length % SEGMENT_SIZE !== 0) return [];

    console.log(data);

    const first64 = '0x' + data.substring(0, SEGMENT_SIZE);
    const exists: boolean = await this.dataSvc.checkEthscriptionExistsByHashId(first64);
    if (!exists) return [];

    const events = [];
    Logger.debug(`Processing batch transfer (${this.web3Svc.chain})`, txn.hash);
    for (let i = 0; i < data.length; i += SEGMENT_SIZE) {
      try {
        const hashId = '0x' + data.substring(i, i + SEGMENT_SIZE).toLowerCase();
        const event = await this.processTransferEvent(hashId, txn, createdAt, i);
        if (event) events.push(event);
      } catch (error) {
        console.log(error);
      }
    }
    return events;
  }

  async processEtherPhunkMarketplaceEvents(
    marketplaceLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of marketplaceLogs) {
      if (!this.web3Svc.marketAddress.includes(log.address?.toLowerCase())) continue;

      // console.log({marketplaceLogs, transaction, createdAt});

      let decoded: DecodeEventLogReturnType;
      try {
        decoded = decodeEventLog({
          abi: etherPhunksMarketProxyAbi,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        console.log(error);
        continue;
      }

      const event = await this.processEtherPhunkMarketplaceEvent(
        transaction,
        createdAt,
        decoded,
        log
      );

      if (event) events.push(event);
    }

    return events;
  }

  async processEtherPhunkMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType,
    log: Log
  ): Promise<Event> {
    const { eventName } = decoded;
    const { args } = decoded as any;

    if (!eventName || !args) return;

    const hashId =
      args.id ||
      args.phunkId ||
      args.potentialEthscriptionId;

    if (!hashId) return;

    const phunkExists = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);
    if (!phunkExists) return;

    if (eventName === 'PhunkBought') {
      const { phunkId: hashId, fromAddress, toAddress, value } = args;

      const bid = await this.sbSvc.getBid(hashId);
      if (bid && bid.fromAddress?.toLowerCase() === toAddress.toLowerCase()) {
        await this.sbSvc.removeBid(hashId);
      }

      await this.sbSvc.removeListing(hashId);

      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: fromAddress.toLowerCase(),
        to: toAddress.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'PhunkBidEntered') {
      const { phunkId: hashId, fromAddress, value } = args;
      await this.sbSvc.createBid(txn, createdAt, hashId, fromAddress, value);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: zeroAddress,
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'PhunkBidWithdrawn') {
      const { phunkId: hashId } = args;
      await this.sbSvc.removeBid(hashId);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: zeroAddress,
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: BigInt(0).toString(),
      };
    }

    if (eventName === 'PhunkNoLongerForSale') {
      const { phunkId: hashId } = args;
      // console.log(args);
      await this.sbSvc.removeListing(hashId);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: zeroAddress,
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: BigInt(0).toString(),
      };
    }

    if (eventName === 'PhunkOffered') {
      const { phunkId: hashId, toAddress, minValue } = args;
      await this.sbSvc.createListing(txn, createdAt, hashId, toAddress, minValue);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: toAddress?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: minValue.toString(),
      };
    }
  }

  // async processAuctionHouseEvents(
  //   auctionHouseLogs: any[],
  //   transaction: Transaction,
  //   createdAt: Date
  // ): Promise<void> {
  //   for (const log of auctionHouseLogs) {

  //     if (log.address.toLowerCase() !== this.web3Svc.auctionAddress) continue;

  //     const decoded = decodeEventLog({
  //       abi: etherPhunksAuctionHouseAbi,
  //       data: log.data,
  //       topics: log.topics,
  //     });

  //     await this.processAuctionHouseEvent(transaction, createdAt, decoded, log);
  //   }
  // }

  // async processAuctionHouseEvent(
  //   txn: Transaction,
  //   createdAt: Date,
  //   decoded: DecodeEventLogReturnType,
  //   log: Log
  // ): Promise<void> {
  //   const { eventName } = decoded;
  //   const { args } = decoded as any;

  //   if (!eventName || !args) return;

  //   const hashId = args.hashId;
  //   if (!hashId) return;

  //   const phunkExists = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);
  //   if (!phunkExists) return;

  //   if (eventName === 'AuctionSettled') {
  //     await this.sbSvc.settleAuction(args);
  //   }

  //   if (eventName === 'AuctionCreated') {
  //     await this.sbSvc.createAuction(args, createdAt);
  //   }

  //   if (eventName === 'AuctionBid') {
  //     await this.sbSvc.createAuctionBid(args, txn, createdAt);
  //   }

  //   if (eventName === 'AuctionExtended') {
  //     await this.sbSvc.extendAuction(args);
  //   }

  //   // event AuctionCreated(bytes32 indexed hashId, address owner, uint256 auctionId, uint256 startTime, uint256 endTime);
  //   // event AuctionBid(bytes32 indexed hashId, uint256 auctionId, address sender, uint256 value, bool extended);
  //   // event AuctionExtended(bytes32 indexed hashId, uint256 auctionId, uint256 endTime);
  //   // event AuctionSettled(bytes32 indexed hashId, uint256 auctionId, address winner, uint256 amount);
  //   // event AuctionTimeBufferUpdated(uint256 timeBuffer);
  //   // event AuctionDurationUpdated(uint256 duration);
  //   // event AuctionReservePriceUpdated(uint256 reservePrice);
  //   // event AuctionMinBidIncrementPercentageUpdated(uint256 minBidIncrementPercentage);
  // }

  // async distributePoints(fromAddress: `0x${string}`): Promise<void> {
  //   try {
  //     const points = await this.web3Svc.getPoints(fromAddress);
  //     await this.sbSvc.updateUserPoints(fromAddress, Number(points));
  //     Logger.log(`Updated user points to ${points}`, fromAddress);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }
}
