import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { SharedModule } from '@/modules/shared/shared.module';

import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { ImageService } from './services/image.service';

import { StorageModule } from '@/modules/storage/storage.module';
import { AppConfigModule } from '@/config/config.module';
@Module({
  controllers: [
    CardsController
  ],
  imports: [
    AppConfigModule,
    HttpModule,
    SharedModule,
    StorageModule,
  ],
  providers: [
    CardsService,

    ImageService,
  ],
  exports: [
    CardsService,
  ]
})
export class CardsModule {}
