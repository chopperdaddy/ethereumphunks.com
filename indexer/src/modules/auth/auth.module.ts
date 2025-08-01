import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AppConfigModule } from '@/config/config.module';
import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AppConfigService } from '@/config/config.service';

@Module({
  controllers: [
    AuthController
  ],
  imports: [
    AppConfigModule,
    SharedModule,
    StorageModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: async (configService: AppConfigService) => ({
        secret: configService.api.privateKey, // TODO: Add dedicated JWT_SECRET env var
        signOptions: {
          expiresIn: '30m', // 30 minutes
          issuer: 'ethereumphunks-admin',
          audience: 'ethereumphunks-admin-users',
        },
        verifyOptions: {
          issuer: 'ethereumphunks-admin',
          audience: 'ethereumphunks-admin-users',
        },
      }),
      inject: [AppConfigService],
    }),
  ],
  providers: [
    AuthService,
    RefreshTokenService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    RefreshTokenService,
    JwtAuthGuard,
  ]
})
export class AuthModule {}
