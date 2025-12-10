import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { AppConfigService } from '@/config/config.service';
import { UtilityService } from '@/modules/shared/services/utility.service';
import { Web3Service } from '@/modules/shared/services/web3.service';
import { StorageService } from '@/modules/storage/storage.service';
import { MarketplaceService } from '@/modules/marketplace/marketplace.service';
import { PointsService } from '@/modules/points/points.service';

import { BridgeProcessingQueue } from '@/modules/queue/queues/bridge-processing.queue';

import * as esips from '@/modules/ethscriptions/constants/esips';
import { esip1, esip2, bridgeL1 } from '@/abi';

import { AttributeItem, Ethscription, Event } from '@/modules/storage/models/db';

import { Log, Transaction, TransactionReceipt, decodeEventLog, hexToString, zeroAddress } from 'viem';

import { createHash } from 'crypto';

@Injectable()
export class EthscriptionsService {

  constructor(
    @Optional() private readonly bridgeQueue: BridgeProcessingQueue,
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    @Inject('WEB3_SERVICE_L2') private readonly web3SvcL2: Web3Service,
    private readonly storageSvc: StorageService,
    private readonly utilitySvc: UtilityService,
    private readonly configSvc: AppConfigService,
    private readonly marketplaceSvc: MarketplaceService,
    private readonly pointsSvc: PointsService,
  ) {}

  /**
   * Processes the ethscriptions for a given transaction.
   *
   * @param transaction - The transaction object.
   * @param receipt - The transaction receipt object.
   * @param createdAt - The creation date of the transaction.
   * @returns An array of events generated from the transaction.
   */
  async processEthscriptionsEvents(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date
  ) {
    const { input } = transaction;
    const events: Event[] = [];

    // Get the data from the transaction
    // Remove null bytes from the string
    const stringData = hexToString(input.toString() as `0x${string}`);
    const cleanedString = stringData.replace(/\x00/g, '');

    // Check if possible ethscription creation (any supported content type)
    const possibleEthPhunk =
      cleanedString.startsWith('data:image/svg+xml,') ||
      cleanedString.startsWith('data:image/png;base64,') ||
      cleanedString.startsWith('data:image/gif;base64,') ||
      cleanedString.startsWith('data:image/jpeg;base64,') ||
      cleanedString.startsWith('data:image/jpg;base64,') ||
      cleanedString.startsWith('data:image/webp;base64,') ||
      cleanedString.startsWith('data:image/avif;base64,') ||
      cleanedString.startsWith('data:video/webm;base64,') ||
      cleanedString.startsWith('data:text/html,') ||
      cleanedString.startsWith('data:text/html;charset=utf-8,') ||
      cleanedString.startsWith('data:application/json,') ||
      cleanedString.startsWith('data:application/json;charset=utf-8,') ||
      cleanedString.startsWith('data:application/pdf;base64,');

    if (possibleEthPhunk) {
      const sha = createHash('sha256').update(cleanedString).digest('hex');

      // Check if the sha exists
      const attributesData = await this.storageSvc.checkIsCuratedCollection(sha);
      if (!attributesData) return;

      // Check if its a duplicate (already been inscribed)
      const isDuplicate = await this.storageSvc.checkEthscriptionExistsBySha(sha);
      if (isDuplicate) return;

      Logger.debug('Processing new ethscription', transaction.hash);
      const event = await this.processEthscriptionCreationEvent(transaction as Transaction, createdAt, attributesData);
      return [event];
    }

    // Check if possible transfer
    const possibleTransfer = this.utilitySvc.possibleTransfer(input);
    if (possibleTransfer) {
      const event = await this.processTransferEvent(
        input,
        transaction as Transaction,
        createdAt
      );
      if (event) events.push(event);
    }

    // Check if possible batch transfer
    const possibleBatchTransfer = this.utilitySvc.possibleBatchTransfer(input);
    if (!possibleTransfer && possibleBatchTransfer) {
      // console.log({ possibleBatchTransfer });
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
        `Processing marketplace event (ESIP1)`,
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
        `Processing marketplace event (ESIP2)`,
        transaction.hash
      );
      const eventArr = await this.processEsip2(esip2Transfers, transaction, createdAt);
      if (eventArr?.length) events.push(...eventArr);
    }

    return events;
  }

  /**
   * Processes the EtherPhunk creation event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the transaction.
   * @param phunkShaData - The PhunkSha data.
   * @returns The processed event object.
   */
  async processEthscriptionCreationEvent(
    txn: Transaction,
    createdAt: Date,
    attributesData: AttributeItem,
  ): Promise<Event> {
    const { from, to, hash: hashId } = txn;

    // Add the ethscription
    await this.storageSvc.addEthscription(txn, createdAt, attributesData);
    Logger.log('Added ethscription', `${hashId.toLowerCase()}`);

    return {
      txId: txn.hash.toLowerCase() + txn.transactionIndex,
      type: 'created',
      hashId: hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash.toLowerCase(),
      txIndex: txn.transactionIndex,
      txHash: (txn.hash).toLowerCase(),
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: BigInt(0).toString(),
    };
  }

  /**
   * Processes a calldata transfer event.
   *
   * @param hashId - The hash ID of the event.
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the event.
   * @param index - The optional index of the event.
   * @returns A Promise that resolves to the processed event or null if the event is not valid.
   */
  async processTransferEvent(
    hashId: string,
    txn: Transaction,
    createdAt: Date,
    index?: number
  ): Promise<Event | null> {
    const ethscript: Ethscription = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    // console.log({ethscript})
    if (!ethscript) return null;

    const { from, to } = txn;
    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === txn.from.toLowerCase();

    // console.log({ isMatchedHashId, transferrerIsOwner, ethscript })

    if (!isMatchedHashId || !transferrerIsOwner) return null;

    Logger.debug(
      `Processing transfer (L1)`,
      txn.hash
    );

    // Update the eth phunk owner
    await this.storageSvc.updateEthscriptionOwner(hashId, ethscript.owner, txn.to);
    Logger.log(
      `Updated ethscription owner to ${txn.to} (Transfer event)`,
      ethscript.hashId
    );

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

  /**
   * Processes a contract transfer event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the event.
   * @param from - The address of the sender.
   * @param to - The address of the recipient.
   * @param hashId - The hash ID of the event.
   * @param log - The log object.
   * @param value - The value of the transfer (optional).
   * @param prevOwner - The previous owner of the event (optional).
   * @returns A Promise that resolves to an Event object or null.
   */
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
    const ethscript: Ethscription = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    if (!ethscript) return null;

    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === from.toLowerCase();

    const samePrevOwner = (ethscript.prevOwner && prevOwner)
      ? ethscript.prevOwner.toLowerCase() === prevOwner.toLowerCase()
      : true;

    if (!isMatchedHashId || !transferrerIsOwner || !samePrevOwner) return null;

    // Update the eth phunk owner
    await this.storageSvc.updateEthscriptionOwner(ethscript.hashId, ethscript.owner, to);
    Logger.log(
      `Updated ethscript owner to ${to} (Contract event)`,
      ethscript.hashId
    );

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

  /**
   * Processes ESIP1 transfers and returns the corresponding events.
   *
   * @param ethscriptionTransfers - An array of ESIP1 transfer logs.
   * @param transaction - The transaction associated with the transfers.
   * @param createdAt - The creation date of the transaction.
   * @returns An array of events.
   */
  async processEsip1(
    ethscriptionTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of ethscriptionTransfers) {
      const decoded = decodeEventLog({
        abi: esip1,
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

  /**
   * Processes the ESIP2 events and returns an array of Event objects.
   *
   * @param previousOwnerTransfers - An array of previous owner transfers.
   * @param transaction - The transaction object.
   * @param createdAt - The creation date of the transaction.
   * @returns A promise that resolves to an array of Event objects.
   */
  async processEsip2(
    previousOwnerTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of previousOwnerTransfers) {
      const decoded = decodeEventLog({
        abi: esip2,
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

  /**
   * Processes an ESIP5 (batch transfer) transaction and returns the corresponding events.
   * @param txn - The transaction to process.
   * @param createdAt - The creation date of the transaction.
   * @returns A promise that resolves to an array of events.
   */
  async processEsip5(
    txn: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const { input } = txn;
    const data = input.substring(2);
    if (!this.utilitySvc.possibleBatchTransfer(input)) return [];

    const allHashes = data.match(/.{1,64}/g).map((hash) => '0x' + hash);
    // console.log(allHashes.length);
    const validItems = await this.storageSvc.checkEthscriptionsExistsByHashIds(allHashes);

    if (!validItems?.length) return [];
    const validHashes = validItems.map((item) => item.hashId);

    const events = [];
    Logger.debug(
      `Processing batch transfer (L1)`,
      txn.hash
    );

    for (let i = 0; i < validHashes.length; i++) {
      try {
        const hashId = validHashes[i].toLowerCase();
        const event = await this.processTransferEvent(hashId, txn, createdAt, i);
        if (event) events.push(event);
      } catch (error) {
        console.log(error);
      }
    }
    return events;
  }

  // TODO: Move this to the bridge module
  /**
   * Processes the bridge mainnet (L1) events.
   *
   * @param bridgeMainnetLogs - An array of bridge mainnet logs.
   * @returns A promise that resolves to void.
   */
  async processBridgeMainnetEvents(bridgeMainnetLogs: any[]): Promise<void> {
    for (const log of bridgeMainnetLogs) {
      const decoded = decodeEventLog({
        abi: bridgeL1,
        data: log.data,
        topics: log.topics,
      });

      const { args, eventName } = decoded as any;
      if (!eventName || !args) return;

      if (eventName === 'HashLocked') {
        const { hashId, prevOwner } = args;

        const locked = await this.storageSvc.lockEthscription(hashId);
        if (!locked) throw new Error('Failed to lock ethscription');

        // Bridge the ethscription
        this.bridgeQueue.addHashLockedToQueue(hashId, prevOwner);

        // args
        // address prevOwner,
        // bytes32 hashId,
        // uint256 nonce,
        // uint256 value
      }

      if (eventName === 'HashUnlocked') {
        const { hashId, prevOwner } = args;
        // const locked = await this.sbSvc.unlockEthscription(hashId);
        // if (locked) throw new Error('Failed to unlock ethscription');

        // args
        // address prevOwner,
        // bytes32 hashId
      }
    }
  }
}
