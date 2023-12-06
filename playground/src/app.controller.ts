import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // get merkloe proofs from leaf
  // @Get('merkle-proofs')
  // getMerkleProofs(@Query() query: { leaf: string }): string {
  //   return this.appService.getMerkleProofs(query.leaf);
  // }

  // // get merkle root
  // @Get('merkle-root')
  // getMerkleRoot(): string {
  //   return this.appService.getMerkleRoot();
  // }
}
