import { Module } from "@nestjs/common";
import { HttpModule } from '@nestjs/axios';

import { AdminService } from "./admin.service";

import { AppConfigModule } from '@/config/config.module';

import { NotifsModule } from '@/modules/notifs/notifs.module';
import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { EthscriptionsModule } from '@/modules/ethscriptions/ethscriptions.module';
import { ProcessingModule } from '@/modules/processing/processing.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CollectionAdminModule } from '@/modules/collection-admin/collection-admin.module';

import { AdminController } from './admin.controller';
@Module({
  controllers: [
    AdminController
  ],
  imports: [
    AppConfigModule,
    HttpModule,
    StorageModule,
    SharedModule,
    EthscriptionsModule,
    CommentsModule,
    NotifsModule,
    ProcessingModule,
    AuthModule,
    CollectionAdminModule
  ],
  providers: [
    AdminService
  ],
  exports: []
})
export class AdminModule {}
