import { Pipe, PipeTransform } from '@angular/core';

import { MarketTypes } from '@/models/pipes';
import { Phunk } from '@/models/graph';

@Pipe({
  standalone: true,
  name: 'marketFilter'
})

export class FilterPipe implements PipeTransform {

  transform(value: Phunk[], marketType: MarketTypes): Phunk[] {

    console.log('FilterPipe', {value, marketType});

    if (!value?.length) return [];
    if (!marketType) return value;

    value = [...value];
    value.filter((res) => res.listing?.minValue !== '0' && res.bid?.value !== '0');
    if (marketType === 'listings') return value.filter((item: any) => item.listing && item.listing.value !== '0');
    if (marketType === 'bids') return value.filter((item: any) => item.bid && item.bid.value !== '0');

    return value;
  }
}
