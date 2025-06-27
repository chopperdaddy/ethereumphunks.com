import { Inject, Injectable, Logger } from '@nestjs/common';

import { decodeEventLog } from 'viem';

import { pointsL1 } from '@/abi';

import { StorageService } from '@/modules/storage/storage.service';
import { Web3Service } from '@/modules/shared/services/web3.service';

@Injectable()
export class PointsService {

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    private readonly storageSvc: StorageService,
  ) {}

  /**
   * Processes the points event logs and updates the users' points.
   * @param pointsLogs - An array of points event logs.
   * @returns A Promise that resolves when the processing is complete.
   */
  async processPointsEvent(pointsLogs: any[]): Promise<void> {

    const usersToUpdate = new Set<`0x${string}`>();

    for (const log of pointsLogs) {
      const decoded = decodeEventLog({
        abi: pointsL1,
        data: log.data,
        topics: log.topics,
      });

      const { args, eventName } = decoded as any;

      if (!eventName || !args) return;
      if (eventName === 'PointsAdded') {
        const { user, amount } = args;
        usersToUpdate.add(user);
      }
    }

    for (const user of usersToUpdate) {
      await this.distributePoints(user);
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
