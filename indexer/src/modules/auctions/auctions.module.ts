import { Module } from '@nestjs/common';

import { AuctionsService } from './auctions.service';

@Module({
  imports: [],
  providers: [
    AuctionsService,
  ],
  exports: [
    AuctionsService,
  ],
})
export class AuctionsModule {}
