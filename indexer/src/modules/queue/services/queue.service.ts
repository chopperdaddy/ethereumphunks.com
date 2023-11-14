import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueEvent, OnQueueFailed, OnQueuePaused, OnQueueResumed, OnQueueWaiting, Process, Processor } from '@nestjs/bull';

// import { UtilityService } from 'src/services/utility.service';
import { ProcessingService } from 'src/services/processing.service';

import { Job, Queue } from 'bull';
import { UtilityService } from 'src/utils/utility.service';

@Injectable()
@Processor('blockProcessingQueue')
export class QueueService {

  @Process({ name: 'blockNumQueue', concurrency: 1 })
  async handleBlockNumberQueue(job: Job<any>) {
    const { blockNum } = job.data;
    await this.processSvc.processBlock(blockNum);
  }

  @OnQueueCompleted({ name: 'blockNumQueue' })
  async onCompleted(job: Job<any>) {
    // Logger.debug(`Completed job ${job.id}`);
  }

  @OnQueueFailed({ name: 'blockNumQueue' })
  async onFailed(job: Job<any>, error: Error) {
    Logger.error('❌', `Failed job ${job.id} with error ${error}`);
    this.queue.pause();
    await this.processSvc.retryBlock(job.data.blockNum);
    this.queue.resume();
  }

  @OnQueuePaused()
  async onPaused() {
    Logger.warn('Queue paused');
  }

  @OnQueueResumed()
  async onResumed() {
    Logger.warn('Queue resumed');
  }

  @OnQueueWaiting()
  async onWaiting(jobId: number | string) {
    // Logger.debug(`Waiting job ${jobId}`);
  }

  @OnQueueError({ name: 'blockNumQueue' })
  async onError(error: Error) {
    // Logger.error(`Error ${error}`);
  }

  @OnQueueActive({ name: 'blockNumQueue' })
  async onActive(job: Job<any>) {
    // When a job is proccessing
    // Logger.debug(`Active job ${job.id}`);
  }

  constructor(
    @InjectQueue('blockProcessingQueue') private readonly queue: Queue,
    private readonly utilSvc: UtilityService,
    private readonly processSvc: ProcessingService
    // private readonly appSvc: AppService
  ) {}
}
