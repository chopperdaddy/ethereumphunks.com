import { Injectable, Logger } from '@nestjs/common';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AppService {
  constructor() {}
}
