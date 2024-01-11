import { Injectable } from '@nestjs/common';

import missingPhunks from '../collections/missing-phunks.json';

@Injectable()
export class CuratedService {

  isCurated(hashId: string): boolean {
    const curated = missingPhunks.find(
      item => item.hashId.toLowerCase().replace(/\s+/g, '') === hashId.toLowerCase().replace(/\s+/g, '')
    );
    return !!curated;
  }

}
