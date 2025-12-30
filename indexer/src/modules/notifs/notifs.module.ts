import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { SharedModule } from '@/modules/shared/shared.module';

import { DiscordService } from '@/modules/notifs/services/discord.service';

import { NotifsService } from './notifs.service';
import { NotifsController } from './notifs.controller';
import { TwitterService } from './services/twitter.service';

import { StorageModule } from '@/modules/storage/storage.module';
import { AppConfigModule } from '@/config/config.module';
@Module({
  controllers: [
    NotifsController
  ],
  imports: [
    AppConfigModule,
    HttpModule,
    SharedModule,
    StorageModule,
  ],
  providers: [
    NotifsService,

    DiscordService,
    TwitterService,
  ],
  exports: [
    NotifsService,
  ]
})
export class NotifsModule {}
