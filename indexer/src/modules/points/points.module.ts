import { Module } from '@nestjs/common';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { PointsService } from './points.service';

@Module({
  imports: [
    SharedModule,
    StorageModule,
  ],
  providers: [
    PointsService,
  ],
  exports: [
    PointsService,
  ],
})
export class PointsModule {}
