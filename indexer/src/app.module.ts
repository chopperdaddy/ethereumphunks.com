import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';
// import { PhunkService } from './services/phunk.service';
// import { EmblemService } from './services/emblem.service';
import { TimeService } from './services/time.service';
// import { PlaygroundService } from './services/playground.service';

@Module({
  providers: [
    // App Service handles the main logic of the indexer
    AppService,
    // Web3 Service handles all interactions with the Ethereum network
    Web3Service,
    // Supabase Service handles all interactions with the Supabase database
    SupabaseService,
    // Time service gets estimates of block times
    TimeService,
    // PG service is for fun
    // PlaygroundService,
    // Create SHAs to validate phunk ethscription images
    // PhunkService,
    // Emblem Service generates the JSON required for listing etherphunks with Emblem Vault
    // EmblemService
  ],
})

export class AppModule {}
