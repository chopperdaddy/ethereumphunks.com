import { Injectable, Logger } from '@nestjs/common';

import { ContractEventName, DecodeEventLogReturnType, Log, Transaction, TransactionReceipt, decodeEventLog, zeroAddress } from 'viem';
import { ExtractAbiEvent } from 'abitype';

import { auctionHouseL1 } from '@/abi';

import { StorageService } from '@/modules/storage/storage.service';
import { AppConfigService } from '@/config/config.service';

import { Event } from '@/modules/storage/models/db';

@Injectable()
export class AuctionsService {

  constructor(
    private readonly configSvc: AppConfigService,
    private readonly storageSvc: StorageService,
  ) {}

  async processEtherPhunkAuctionEvents(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date
  ): Promise<Event[]> {
    const events = [];

    // Filter logs for EtherPhunk Marketplace events
    const logs = receipt.logs as Log<bigint, number, false, ExtractAbiEvent<typeof auctionHouseL1, ContractEventName<typeof auctionHouseL1>>>[];
    const marketplaceLogs = logs.filter(
      (log) => log.address.toLowerCase() === this.configSvc.contracts.auctionHouse.l1.toLowerCase()
    );

    if (marketplaceLogs.length) {
      Logger.debug(
        `Processing EtherPhunk Auction event (L1)`,
        transaction.hash
      );

      for (const log of marketplaceLogs) {
        if (!this.configSvc.contracts.auctionHouse.l1.includes(log.address?.toLowerCase())) continue;

        let decoded: DecodeEventLogReturnType<typeof auctionHouseL1, ContractEventName<typeof auctionHouseL1>>;
        try {
          decoded = decodeEventLog({
            abi: auctionHouseL1,
            data: log.data,
            topics: log.topics,
          });
        } catch (error) {
          console.log(error);
          continue;
        }

        const event = await this.processEtherPhunkAuctionEvent(
          transaction,
          createdAt,
          decoded,
          log
        );

        if (event) events.push(event);
      }
    }

    return events;
  }

  async processEtherPhunkAuctionEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType<typeof auctionHouseL1, ContractEventName<typeof auctionHouseL1>>,
    log: Log
  ): Promise<Event> {
    const { eventName } = decoded;
    const { args } = decoded;

    if (!eventName || !args) return;

    if (!('hashId' in args) || !args.hashId) return;

    const phunk = await this.storageSvc.checkEthscriptionExistsByHashId(args.hashId);
    if (!phunk) return;

    console.log({decoded, phunk});

    // AuctionCreated
    // AuctionBid
    // AuctionExtended
    // AuctionSettled

    if (eventName === 'AuctionCreated') {
      const { hashId, owner, auctionId, startTime, endTime } = args as {
        hashId: string;
        owner: string;
        auctionId: bigint;
        startTime: bigint;
        endTime: bigint;
      };

      // We do this here because this event is emitted after
      // transfer of ownership. If the auction was NOT created
      // by the previous owner, or ownership was not transferred to the
      // auction house, we should ignore it.
      const previousOwner = phunk.prevOwner?.toLowerCase();
      const currentOwner = phunk.owner?.toLowerCase();
      const auctionOwner = owner.toLowerCase();
      const transactionSender = txn.from?.toLowerCase();
      const auctionHouseAddress = this.configSvc.contracts.auctionHouse.l1.toLowerCase();

      if (
        !previousOwner ||
        previousOwner !== auctionOwner ||
        auctionOwner !== transactionSender ||
        currentOwner !== auctionHouseAddress
      ) {
        Logger.error('Auction not created by previous owner or owner is not the auction house', hashId);
        return;
      }

      await this.storageSvc.createAuction({ hashId, owner, auctionId, startTime, endTime }, createdAt);

      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: owner.toLowerCase(),
        to: this.configSvc.contracts.auctionHouse.l1.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: '0',
      };
    }

    if (eventName === 'AuctionSettled') {
      const { hashId, auctionId, winner, amount } = args as {
        hashId: string;
        auctionId: bigint;
        winner: string;
        amount: bigint;
      };

      await this.storageSvc.settleAuction({ hashId, auctionId, winner, amount });

      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: winner.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: amount.toString(),
      };
    }

    if (eventName === 'AuctionBid') {
      const { hashId, auctionId, sender, value, extended } = args as {
        hashId: string;
        auctionId: bigint;
        sender: string;
        value: bigint;
        extended: boolean;
      };

      await this.storageSvc.createAuctionBid({ hashId, auctionId, sender, value, extended }, txn, createdAt);
      const auction = await this.storageSvc.getAuctionById(Number(auctionId));

      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: auction.prevOwner.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }
  }
}
