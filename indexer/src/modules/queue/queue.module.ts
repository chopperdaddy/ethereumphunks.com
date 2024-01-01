import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { BullModule } from '@nestjs/bull';

import { BlockService } from './services/block.service';
import { QueueService } from './services/queue.service';

import { UtilityService } from 'src/utils/utility.service';
import { ProcessingService } from 'src/services/processing.service';
import { Web3Service } from 'src/services/web3.service';
import { SupabaseService } from 'src/services/supabase.service';
import { DataService } from 'src/services/data.service';
import { TimeService } from 'src/utils/time.service';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '1' ? 'mainnet' : 'goerli';

@Module({
  imports: [
    HttpModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379
      }
    }),
    BullModule.registerQueue({
      name: `blockProcessingQueue_${chain}`
    }),
  ],
  providers: [
    QueueService,
    BlockService,

    ProcessingService,
    Web3Service,
    SupabaseService,
    UtilityService,
    TimeService,
    DataService,
  ],
  exports: [
    BlockService,
    TimeService
  ],
})
export class QueueModule {}
