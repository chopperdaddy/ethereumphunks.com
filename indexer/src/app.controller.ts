import { Body, Controller, Logger, Post } from '@nestjs/common';

@Controller()
export class AppController {

  constructor() {}

  queue: Array<string> = [];

  @Post('ethscriptions')
  async ethscriptions(@Body() body: any): Promise<any> {
    return;
  }
}
