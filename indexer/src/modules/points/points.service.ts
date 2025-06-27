import { Inject, Injectable, Logger } from '@nestjs/common';

import { ContractEventName, decodeEventLog, DecodeEventLogReturnType, Log, Transaction, TransactionReceipt } from 'viem';
import { ExtractAbiEvent } from 'abitype';

import { marketL1, pointsL1 } from '@/abi';

import { AppConfigService } from '@/config/config.service';
import { StorageService } from '@/modules/storage/storage.service';
import { Web3Service } from '@/modules/shared/services/web3.service';

@Injectable()
export class PointsService {

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    private readonly storageSvc: StorageService,
    private readonly configSvc: AppConfigService,
  ) {}

  /**
   * Processes the points event logs and updates the users' points.
   * @param pointsLogs - An array of points event logs.
   * @returns A Promise that resolves when the processing is complete.
   */
  async processPointsEvents(receipt: TransactionReceipt): Promise<void> {

    const logs = receipt.logs as Log<bigint, number, false, ExtractAbiEvent<typeof pointsL1, ContractEventName<typeof pointsL1>>>[];
    const pointsLogs = logs.filter(
      (log) => log.address.toLowerCase() === this.configSvc.contracts.points.l1.toLowerCase()
    );
    if (pointsLogs.length) {
      Logger.debug(
        `Processing Points event (L1)`,
        receipt.transactionHash
      );

      const usersToUpdate = new Set<`0x${string}`>();

      for (const log of pointsLogs) {
        if (!this.configSvc.contracts.points.l1.includes(log.address?.toLowerCase())) continue;

        let decoded: DecodeEventLogReturnType<typeof pointsL1, ContractEventName<typeof pointsL1>>;
        try {
          decoded = decodeEventLog({
            abi: pointsL1,
            data: log.data,
            topics: log.topics,
          });
        } catch (error) {
          console.log(error);
          continue;
        }

        const { args, eventName } = decoded;
        if (!eventName || !args) continue;

        if (eventName === 'PointsAdded') usersToUpdate.add(args.user);
      }

      for (const user of usersToUpdate) await this.distributePoints(user);
    }
  }

  /**
   * Distributes points to a user from a given address.
   * @param fromAddress The address from which the points will be distributed.
   * @returns A Promise that resolves when the points are successfully distributed.
   */
  async distributePoints(fromAddress: `0x${string}`): Promise<void> {
    try {
      const points = await this.web3SvcL1.getPoints(fromAddress);
      await this.storageSvc.updateUserPoints(fromAddress, Number(points));
      Logger.log(
        `Updated user points to ${points.toString()}`,
        fromAddress
      );
    } catch (error) {
      console.log(error);
    }
  }
}
