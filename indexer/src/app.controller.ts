import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { VerificationService } from './services/verification.service';

@Controller()
export class AppController {

  constructor(
    private readonly appService: AppService,
    private readonly verifSvc: VerificationService
  ) {}

  @Post('bridge-phunk')
  async bridgePhunk(@Body() body): Promise<any> {
    console.log({ body })
    return await this.verifSvc.verifySignature(body);
  }

  // get merkloe proofs from leaf
  @Get('merkle-proofs')
  getMerkleProofs(@Query() query: { leaf: string }): string {
    return this.appService.getMerkleProofs(query.leaf);
  }

  // get merkle root
  @Get('merkle-root')
  getMerkleRoot(): string {
    return this.appService.getMerkleRoot();
  }
}
