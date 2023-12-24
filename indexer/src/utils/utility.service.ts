import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilityService {
  public async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public dataURLtoBuffer(dataURL: string): Buffer {
    const base64String = dataURL.split(',')[1];
    const buffer = Buffer.from(base64String, 'base64');
    return buffer;
  }
}
