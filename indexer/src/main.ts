import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import './polyfill';

async function bootstrap() {
  await NestFactory.create(AppModule);
}

bootstrap();
