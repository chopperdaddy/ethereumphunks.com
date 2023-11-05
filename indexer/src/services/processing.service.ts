import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from './supabase.service';
import { Web3Service } from './web3.service';

import { esip1Abi, esip2Abi } from 'src/abi/EthscriptionsProtocol';
import { etherPhunksMarketAbi } from 'src/abi/EtherPhunksMarket';

import hashIds from 'src/constants/hashIds.json';

import { DecodeEventLogReturnType, FormattedTransaction, Log, Transaction, decodeEventLog, hexToString } from 'viem';

import { TransferEthscriptionForPreviousOwnerSignature, TransferEthscriptionSignature } from 'src/constants/EthscriptionsProtocol';

import { Phunk } from 'src/models/db';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SEGMENT_SIZE = 64;
const hashIdsSet = new Set(hashIds);

@Injectable()
export class ProcessingService {

  constructor(
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService,
  ) {}

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
          await this.processEthscriptionEvent(transaction as Transaction, createdAt, cleanedString);
          continue;
        }

        // Check if possible transfer
        const possibleTransfer = transaction.input.substring(2).length === SEGMENT_SIZE;
        if (possibleTransfer) {
          Logger.debug(`Processing transfer (${this.web3Svc.chain})`, transaction.hash);
          await this.processTransferEvent(
            transaction.input,
            transaction as Transaction,
            createdAt
          );
          continue;
        }

        const possibleBatchTransfer = transaction.input.substring(2).length % SEGMENT_SIZE === 0;
        if (possibleBatchTransfer) {
          await this.processEsip5(
            transaction as Transaction,
            createdAt
          );
        }

        // Check if possible marketplace event
        const receipt = await this.web3Svc.getTransactionReceipt(hash);

        // Filter logs for ethscription transfers (esip1)
        const esip1Transfers = receipt.logs.filter(
          (log: any) => log.topics[0] === TransferEthscriptionSignature
        );
        if (esip1Transfers.length) {
          Logger.debug(
            `Processing marketplace event (esip1) (${this.web3Svc.chain})`,
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
            `Processing marketplace event (esip2) (${this.web3Svc.chain})`,
            transaction.hash
          );
          await this.processEsip2(esip2Transfers, transaction, createdAt);
        }

        // Filter logs for EtherPhunk Marketplace events
        const marketplaceLogs = receipt.logs.filter(
          (log: any) => log.address === this.web3Svc.marketAddress
        );
        if (marketplaceLogs.length) {
          await this.processMarketplaceEvents(marketplaceLogs, transaction, createdAt);
        }

      } catch (error) {
        Logger.error(
          error.shortMessage || error.message || error,
          hash
        );
        i = i - 1;
        await this.delay(1000);
      }
    }
  }

  async processEthscriptionEvent(txn: Transaction, createdAt: Date, cleanedString: string): Promise<void> {
    const content = cleanedString.split('data:image/svg+xml,')[1];
    if (!content) return;

    const { from, to, hash } = txn;
    // Check if the sha already exists in the shas table
    const sha = crypto.createHash('sha256').update(cleanedString).digest('hex');
    const phunkId = await this.sbSvc.checkIsEthPhunks(sha);
    if (!phunkId && phunkId !== 0) return;

    // Check if the sha already exists in the ethPhunks table
    const isDuplicate = await this.sbSvc.checkEthPhunkExistsBySha(sha);
    if (isDuplicate) return;

    // Get or create the users from address
    const [ toUser, fromUser ] = await Promise.all([
      from.toLowerCase() === to.toLowerCase() ? null : this.sbSvc.getOrCreateUser(from, createdAt),
      this.sbSvc.getOrCreateUser(to, createdAt)
    ]);

    // Add the ethereum phunk
    await this.sbSvc.addEthPhunk(txn, createdAt, phunkId, sha);
    // Add the creation event
    await this.sbSvc.addEvent(txn, from, to, hash, phunkId, 'created', createdAt, BigInt(0), 0);
    Logger.log('Added eth phunk', `${phunkId} -- ${hash.toLowerCase()}`);
  }

  async processTransferEvent(
    hashId: string,
    txn: Transaction,
    createdAt: Date,
  ): Promise<void> {
    const ethPhunk: Phunk = await this.sbSvc.checkEthPhunkExistsByHashId(hashId);
    if (!ethPhunk) return;

    const { from, to } = txn;
    const isMatchedHashId = ethPhunk.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === txn.from.toLowerCase();

    if (!isMatchedHashId || !transferrerIsOwner) return;

    // Get or create the users from address
    await this.sbSvc.getOrCreateUser(to, createdAt);

    // Update the eth phunk owner
    await this.sbSvc.updateEthPhunkOwner(hashId, ethPhunk.owner, txn.to);

    // Add the transfer event
    await this.sbSvc.addEvent(txn, from, to, hashId, ethPhunk.phunkId, 'transfer', createdAt, txn.value, Date.now());
    Logger.log('Updated eth phunk owner', `Hash: ${hashId} -- To: ${txn.to.toLowerCase()}`);
  }

  async processContractTransferEvent(
    txn: Transaction,
    createdAt: Date,
    from: string,
    to: string,
    hashId: string,
    value?: bigint,
    prevOwner?: string,
    log?: Log,
  ): Promise<void> {
    const ethPhunk: Phunk = await this.sbSvc.checkEthPhunkExistsByHashId(hashId);
    if (!ethPhunk) return;

    const isMatchedHashId = ethPhunk.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === from.toLowerCase();

    const samePrevOwner = (ethPhunk.prevOwner && prevOwner) ? ethPhunk.prevOwner.toLowerCase() === prevOwner.toLowerCase() : true;

    if (!isMatchedHashId || !transferrerIsOwner || !samePrevOwner) return;

    // Get or create the users from address
    await this.sbSvc.getOrCreateUser(to, createdAt);

    // Update the eth phunk owner
    await this.sbSvc.updateEthPhunkOwner(ethPhunk.hashId, ethPhunk.owner, to);

    // Add the sale/transfer event
    await this.sbSvc.addEvent(
      txn,
      from,
      to,
      ethPhunk.hashId,
      ethPhunk.phunkId,
      'transfer',
      createdAt,
      value,
      log.logIndex
    );
    Logger.log('Updated eth phunk owner (contract event)', `Hash: ${ethPhunk.hashId} -- To: ${to.toLowerCase()}`);
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

      await this.processContractTransferEvent(
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

      await this.processContractTransferEvent(
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

  async processEsip5(txn: Transaction, createdAt: Date) {
    const { input } = txn;
    const data = input.substring(2);
    if (data.length % SEGMENT_SIZE !== 0) return;

    const first64 = '0x' + data.substring(0, SEGMENT_SIZE);
    const exists: Phunk = await this.sbSvc.checkEthPhunkExistsByHashId(first64);
    if (!exists) return;

    Logger.debug(`Processing batch transfer (${this.web3Svc.chain})`, txn.hash);
    for (let i = 0; i < data.length; i += SEGMENT_SIZE) {
      try {
        const hashId = '0x' + data.substring(i, i + SEGMENT_SIZE).toLowerCase();
        await this.processTransferEvent(hashId, txn, createdAt);
      } catch (error) {
        console.log(error);
      }
    }
  }

  async processMarketplaceEvents(
    marketplaceLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<void> {
    for (const log of marketplaceLogs) {

      if (log.address.toLowerCase() !== this.web3Svc.marketAddress) continue;

      const decoded = decodeEventLog({
        abi: etherPhunksMarketAbi,
        data: log.data,
        topics: log.topics,
      });

      await this.processMarketplaceEvent(transaction, createdAt, decoded, log);
    }
  }

  async processMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType,
    log: Log
  ): Promise<void> {
    const { eventName } = decoded;
    const { args } = decoded as any;

    if (!eventName || !args) return;

    const phunkId =
      args.id ||
      args.phunkId ||
      args.potentialEthscriptionId;

    const phunkExists = await this.sbSvc.checkEthPhunkExistsByHashId(phunkId);
    if (!phunkExists) return;

    if (eventName === 'PhunkBought') {
      const { phunkId, fromAddress, toAddress, value } = args;
      await this.sbSvc.removeListing(createdAt, phunkId);
      await this.sbSvc.addEvent(
        txn,
        fromAddress,
        toAddress,
        phunkId,
        phunkExists.phunkId,
        eventName,
        createdAt,
        value,
        log.logIndex
      );
    }

    if (eventName === 'PhunkBidEntered') {
      const { phunkId, fromAddress, value } = args;
      await this.sbSvc.createBid(txn, createdAt, phunkId, fromAddress, value);
      await this.sbSvc.addEvent(
        txn,
        txn.from,
        null,
        phunkId,
        phunkExists.phunkId,
        eventName,
        createdAt,
        value,
        log.logIndex
      );
    }

    if (eventName === 'PhunkBidWithdrawn') {
      const { phunkId } = args;
      await this.sbSvc.removeBid(createdAt, phunkId);
      await this.sbSvc.addEvent(
        txn,
        txn.from,
        null,
        phunkId,
        phunkExists.phunkId,
        eventName,
        createdAt,
        BigInt(0),
        log.logIndex
      );
    }

    if (eventName === 'PhunkNoLongerForSale') {
      const { phunkId } = args;
      console.log(args);
      await this.sbSvc.removeListing(createdAt, phunkId);
      await this.sbSvc.addEvent(
        txn,
        txn.from,
        null,
        phunkId,
        phunkExists.phunkId,
        eventName,
        createdAt,
        BigInt(0),
        log.logIndex
      );
    }

    if (eventName === 'PhunkOffered') {
      const { phunkId, toAddress, minValue } = args;
      await this.sbSvc.createListing(txn, createdAt, phunkId, toAddress, minValue);
      await this.sbSvc.addEvent(
        txn,
        txn.from,
        toAddress,
        phunkId,
        phunkExists.phunkId,
        eventName,
        createdAt,
        minValue,
        log.logIndex
      );
    }
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

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
