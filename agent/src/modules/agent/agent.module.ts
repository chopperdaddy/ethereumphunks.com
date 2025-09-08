import { Module } from '@nestjs/common';

import { KeyGenService } from './services/key-gen.service';
import { AgentService } from './agent.service';

@Module({
  imports: [],
  controllers: [],
  providers: [
    KeyGenService,
    AgentService,
  ],
  exports: [],
})
export class AgentModule {}
