import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: ['GET'],
  });
  await app.listen(Number(process.env.PORT));
}
bootstrap();
