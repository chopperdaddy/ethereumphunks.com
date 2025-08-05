import { Pipe, PipeTransform } from '@angular/core';

import { rarityData } from '@/constants/collections';

@Pipe({
  standalone: true,
  name: 'traitRarity'
})
export class TraitRarityPipe implements PipeTransform {

  transform(value: string, slug: string): string {
    return rarityData[slug][value];
  }
}
