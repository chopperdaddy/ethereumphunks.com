import { Injectable, Logger } from '@nestjs/common';
import { OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';

// import { UtilityService } from 'src/services/utility.service';
import { ProcessingService } from 'src/services/processing.service';

import { Job } from 'bull';

@Injectable()
@Processor('blockProcessingQueue')
export class QueueService {

  @Process({ name: 'blockNumQueue', concurrency: 1 })
  async handleBlockNumberQueue(job: Job) {
    const { blockNum, chain, timestamp } = job.data;

    Logger.debug(`Block Timestamp: ${timestamp}`, `Processing Block ${blockNum} (${chain})`);
    await this.processSvc.processBlock(job.data.blockNum);
  }

  @OnQueueCompleted({ name: 'blockNumQueue' })
  async onCompleted(job: Job<any>) {
    // Logger.debug(`Completed job ${job.id}`);
  }

  @OnQueueFailed({ name: 'blockNumQueue' })
  async onFailed(job: Job<any>) {
    // Logger.debug(`Failed job ${job.id}`);
  }

  @OnQueueError({ name: 'blockNumQueue' })
  async onError(error: Error) {
    Logger.error(`Error ${error}`);
  }

  @OnQueueActive({ name: 'blockNumQueue' })
  async onActive(job: Job<any>) {
    // Logger.debug(`Active job ${job.id}`);
  }

  constructor(
    // private readonly utilSvc: UtilityService,
    private readonly processSvc: ProcessingService
    // private readonly appSvc: AppService
  ) {}
}
