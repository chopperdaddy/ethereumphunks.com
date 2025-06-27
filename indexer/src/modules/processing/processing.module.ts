import { Module } from '@nestjs/common';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { EthscriptionsModule } from '@/modules/ethscriptions/ethscriptions.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { NotifsModule } from '@/modules/notifs/notifs.module';
import { MarketplaceModule } from '@/modules/marketplace/marketplace.module';
import { PointsModule } from '@/modules/points/points.module';
import { AuctionsModule } from '@/modules/auctions/auctions.module';

import { ProcessingService } from './processing.service';

@Module({
  imports: [
    SharedModule,
    StorageModule,
    EthscriptionsModule,
    CommentsModule,
    NotifsModule,
    MarketplaceModule,
    PointsModule,
    AuctionsModule,
  ],
  providers: [
    ProcessingService,
  ],
  exports: [
    ProcessingService
  ]
})
export class ProcessingModule {}
