import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';
import { PhunkService } from './services/phunk.service';

@Module({
  imports: [HttpModule],
  providers: [
    Web3Service,
    SupabaseService,
    PhunkService
  ],
})

export class AppModule {}
