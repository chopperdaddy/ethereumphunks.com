import { Module } from "@nestjs/common";

import { CollectionAdminController } from "./collection-admin.controller";

import { AuthModule } from "@/modules/auth/auth.module";
import { StorageModule } from "@/modules/storage/storage.module";

import { CollectionAdminService } from './collection-admin.service';
import { SharedModule } from '@/modules/shared/shared.module';

@Module({
  controllers: [CollectionAdminController],
  imports: [
    AuthModule,
    StorageModule,
    SharedModule
  ],
  providers: [
    CollectionAdminService
  ],
  exports: [
    CollectionAdminService
  ]
})
export class CollectionAdminModule {}
