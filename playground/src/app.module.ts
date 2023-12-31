import { Module } from '@nestjs/common';

import { AppController } from './app.controller';

import { AppService } from './app.service';
import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';
import { UtilityService } from './utils/utility.service';
import { CollectionService } from './services/collection.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    // App Service handles the main logic of the indexer
    AppService,
    // Web3 Service handles all interactions with the Ethereum network
    Web3Service,
    // Supabase Service handles all interactions with the Supabase database
    SupabaseService,
    CollectionService,
    // Processing Service handles the logic of processing transactions
    // ProcessingService,
    // Time service gets estimates of block times
    // TimeService,
    // PG service is for fun
    // PlaygroundService,
    // Create SHAs to validate phunk ethscription images
    // PhunkService,
    // Emblem Service generates the JSON required for listing etherphunks with Emblem Vault
    // EmblemService,
    // Utility Service provides a reusable utility functions
    UtilityService
  ],
})

export class AppModule {}
