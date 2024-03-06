import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { UtilityService } from 'src/utils/utility.service';
import { ProcessingService } from 'src/services/processing.service';
import { Web3Service } from 'src/services/web3.service';
import { SupabaseService } from 'src/services/supabase.service';
import { CuratedService } from 'src/services/curated.service';
import { TelegramService } from 'src/modules/notifs/services/telegram.service';
import { DataService } from 'src/services/data.service';
import { TimeService } from 'src/utils/time.service';

import dotenv from 'dotenv';
dotenv.config();

const chain: 'mainnet' | 'sepolia' = process.env.CHAIN_ID === '1' ? 'mainnet' : 'sepolia';

@Module({
  imports: [
    HttpModule
  ],
  providers: [
    // ProcessingService,
    // Web3Service,
    // SupabaseService,
    // UtilityService,
    // TimeService,
    // DataService,
    // CuratedService,

    TelegramService
  ],
})
export class NotifsModule {}
