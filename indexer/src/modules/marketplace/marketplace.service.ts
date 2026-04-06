import { Injectable, Logger } from '@nestjs/common';

import { ContractEventName, DecodeEventLogReturnType, Log, Transaction, TransactionReceipt, decodeEventLog, zeroAddress } from 'viem';
import { ExtractAbiEvent } from 'abitype';

import { marketL1 } from '@/abi';

import { StorageService } from '@/modules/storage/storage.service';
import { AppConfigService } from '@/config/config.service';

import { Event } from '@/modules/storage/models/db';
import { mkdir, writeFile } from 'fs/promises';

@Injectable()
export class MarketplaceService {

  constructor(
    private readonly configSvc: AppConfigService,
    private readonly storageSvc: StorageService,
  ) {}

  /**
   * Processes the EtherPhunk marketplace contract events.
   *
   * @param marketplaceLogs - The array of marketplace logs.
   * @param transaction - The transaction object.
   * @param createdAt - The creation date of the events.
   * @returns A promise that resolves to an array of events.
   */
  async processEtherPhunkMarketplaceEvents(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];

    // Filter logs for EtherPhunk Marketplace events
    const logs = receipt.logs as Log<bigint, number, false, ExtractAbiEvent<typeof marketL1, ContractEventName<typeof marketL1>>>[];
    const marketplaceLogs = logs.filter(
      (log) => log.address.toLowerCase() === this.configSvc.contracts.market.l1.toLowerCase()
    );

    if (marketplaceLogs.length) {
      Logger.debug(
        `Processing EtherPhunk Marketplace event (L1)`,
        transaction.hash
      );

      for (const log of marketplaceLogs) {
        if (!this.configSvc.contracts.market.l1.includes(log.address?.toLowerCase())) continue;

        let decoded: DecodeEventLogReturnType<typeof marketL1, ContractEventName<typeof marketL1>>;
        try {
          decoded = decodeEventLog({
            abi: marketL1,
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
    }

    return events;
  }

  /**
   * Processes an individual EtherPhunk marketplace event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The timestamp when the event was created.
   * @param decoded - The decoded event log.
   * @param log - The log object.
   * @returns A promise that resolves to an Event object.
   */
  async processEtherPhunkMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType<typeof marketL1, ContractEventName<typeof marketL1>>,
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

    const phunk = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    if (!phunk) return;

    if (eventName === 'PhunkBought') {
      const { phunkId: hashId, fromAddress, toAddress, value } = args;

      const removedListing = await this.storageSvc.removeListing(hashId);
      if (!removedListing) return;

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

    if (eventName === 'PhunkNoLongerForSale') {
      const { phunkId: hashId } = args;

      const removedListing = await this.storageSvc.removeListing(hashId);
      if (!removedListing) return;

      if (txn.from === phunk.prevOwner) {
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
    }

    if (eventName === 'PhunkOffered') {
      const { phunkId: hashId, toAddress, minValue } = args;

      // We do this here because this event is emitted after
      // transfer of ownership. If the listing was NOT created
      // by the previous owner, we should ignore it.
      // When listing, the owner should always be the marketplace contract.
      if (
        (phunk.prevOwner && (phunk.prevOwner !== txn.from)) ||
        phunk.owner !== this.configSvc.contracts.market.l1.toLowerCase()
      ) {

        // Write the failed listing to a file
        try { await mkdir('./failed'); } catch (error) {}
        await writeFile(`./failed/${hashId}.json`, JSON.stringify({ txn: txn.hash, phunk }));
        Logger.error(
          'Listing not created by previous owner or owner is not the marketplace contract',
          hashId
        );

        // Since this listing will STILL overwrite existing listings
        // on the smart contract, we must delete the existing listing
        // from the database (sorry to the OG lister!)
        await this.storageSvc.removeListing(hashId);
        return;
      }

      // console.log({ hashId, toAddress, minValue });

      await this.storageSvc.createListing(txn, createdAt, hashId, toAddress, minValue);
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
}
