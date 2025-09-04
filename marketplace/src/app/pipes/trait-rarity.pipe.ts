import { inject, Pipe, PipeTransform } from '@angular/core';

import { AttributesService } from '@/services/attributes.service';

@Pipe({
  standalone: true,
  name: 'traitRarity'
})
export class TraitRarityPipe implements PipeTransform {
  private attributesSvc = inject(AttributesService);

  async transform(value: string, slug: string): Promise<string> {
    // Try to get dynamic rarity data from the data service's in-memory cache
    const dynamicRarity = await this.attributesSvc.getRarityData(slug);
    // console.log({ dynamicRarity });
    if (dynamicRarity && dynamicRarity[value] !== undefined) {
      return dynamicRarity[value].toString();
    }

    // Fallback to static rarity data
    return '';
  }
}
