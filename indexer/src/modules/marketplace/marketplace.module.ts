import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config/config.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    AppConfigModule,
    StorageModule,
  ],
  providers: [
    MarketplaceService,
  ],
  exports: [
    MarketplaceService,
  ],
})
export class MarketplaceModule {}
