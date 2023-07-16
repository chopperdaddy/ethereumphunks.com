import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';

import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';
import { PhunkService } from './services/phunk.service';

@Module({
  imports: [HttpModule],
  controllers: [AppController],
  providers: [
    Web3Service,
    SupabaseService,
    PhunkService
  ],
})

export class AppModule {}
