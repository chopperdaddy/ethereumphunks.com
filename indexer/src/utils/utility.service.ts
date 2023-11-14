import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilityService {
  public async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
