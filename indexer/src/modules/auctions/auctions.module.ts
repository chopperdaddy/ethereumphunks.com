import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config/config.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { AuctionsService } from './auctions.service';

@Module({
  imports: [
    AppConfigModule,
    StorageModule,
  ],
  providers: [
    AuctionsService,
  ],
  exports: [
    AuctionsService,
  ],
})
export class AuctionsModule {}
