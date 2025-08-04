import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConditionalModule } from '@nestjs/config';

import { StorageModule } from '@/modules/storage/storage.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { SharedModule } from '@/modules/shared/shared.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { NotifsModule } from '@/modules/notifs/notifs.module';
import { BridgeL1Module } from '@/modules/bridge-l1/bridge-l1.module';
import { BridgeL2Module } from '@/modules/bridge-l2/bridge-l2.module';
import { EthscriptionsModule } from '@/modules/ethscriptions/ethscriptions.module';
import { TxPoolModule } from '@/modules/tx-pool/tx-pool.module';
import { EthscriptionsMintModule } from '@/modules/ethscriptions-mint/ethscriptions-mint.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ProcessingModule } from '@/modules/processing/processing.module';
import { EvmModule } from '@/modules/evm/evm.module';
import { CollectionAdminModule } from '@/modules/collection-admin/collection-admin.module';

import { AuctionsModule } from '@/modules/auctions/auctions.module';
import { MarketplaceModule } from '@/modules/marketplace/marketplace.module';
import { PointsModule } from '@/modules/points/points.module';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { AppGateway } from '@/app.gateway';

import { DataService } from '@/modules/shared/services/data.service';
import { ProcessingService } from '@/modules/processing/processing.service';

import { ApiKeyMiddleware } from '@/middleware/api-key.middleware';
import { AppConfigModule } from '@/config/config.module';

@Module({
  imports: [
    AppConfigModule,
    HttpModule,

    EvmModule,

    EthscriptionsModule,

    NotifsModule,
    SharedModule,

    CommentsModule,
    StorageModule,
    AdminModule,
    CollectionAdminModule,
    AuthModule,
    ProcessingModule,

    MarketplaceModule,
    PointsModule,
    AuctionsModule,

    ConditionalModule.registerWhen(
      BridgeL1Module,
      (config) => (!!Number(config['BRIDGE']))
    ),

    ConditionalModule.registerWhen(
      BridgeL2Module,
      (config) => (!!Number(config['BRIDGE']))
    ),

    ConditionalModule.registerWhen(
      EthscriptionsMintModule,
      (config) => (!!Number(config['MINT']))
    ),

    ConditionalModule.registerWhen(
      QueueModule,
      (config) => (!!Number(config['QUEUE']))
    ),

    ConditionalModule.registerWhen(
      TxPoolModule,
      (config) => (!!Number(config['TX_POOL']))
    ),
  ],
  controllers: [
    AppController
  ],
  providers: [
    AppService,
    AppGateway,
    ProcessingService,
    DataService,
  ],
})

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware)
      .forRoutes({
        path: '/admin/*',
        method: RequestMethod.ALL
      },
      {
        path: '/ethscriptions/*',
        method: RequestMethod.POST
      },
      {
        path: '/notifications/*',
        method: RequestMethod.POST
      },
      {
        path: '/bridge-l1/*',
        method: RequestMethod.POST
      },
      {
        path: '/queue/*',
        method: RequestMethod.POST
      }
    );
  }
}
