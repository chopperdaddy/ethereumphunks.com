

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { BlockService } from './services/block.service';
import { QueueService } from './services/queue.service';
import { UtilityService } from 'src/services/utility.service';
import { ProcessingService } from 'src/services/processing.service';
import { Web3Service } from 'src/services/web3.service';
import { SupabaseService } from 'src/services/supabase.service';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379
      }
    }),
    BullModule.registerQueue({
      name: 'blockProcessingQueue'
    }),
  ],
  providers: [
    QueueService,
    BlockService,

    ProcessingService,
    Web3Service,
    SupabaseService,
    UtilityService
  ],
  exports: [
    BlockService
  ],
})
export class QueueModule {}
