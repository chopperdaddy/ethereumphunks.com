import { inject, Pipe, PipeTransform } from '@angular/core';

import { DataService } from '@/services/data.service';

@Pipe({
  standalone: true,
  name: 'traitRarity'
})
export class TraitRarityPipe implements PipeTransform {
  private dataSvc = inject(DataService);

  async transform(value: string, slug: string): Promise<string> {
    // Try to get dynamic rarity data from the data service's in-memory cache
    const dynamicRarity = await this.dataSvc.getRarityData(slug);
    // console.log({ dynamicRarity });
    if (dynamicRarity && dynamicRarity[value] !== undefined) {
      return dynamicRarity[value].toString();
    }

    // Fallback to static rarity data
    return '';
  }
}
