import { Module } from '@nestjs/common';

import { KeyGenService } from './services/key-gen.service';
import { AgentService } from './agent.service';
import { LangchainService } from './services/langchain.service';
import { PersonalityDatabaseService } from './services/personality-database.service';
import { PersonalityService } from './services/personality.service';
import { PersonalityController } from './personality.controller';

@Module({
  imports: [],
  controllers: [PersonalityController],
  providers: [
    KeyGenService,
    AgentService,
    LangchainService,
    PersonalityDatabaseService,
    PersonalityService,
  ],
  exports: [],
})
export class AgentModule {}
