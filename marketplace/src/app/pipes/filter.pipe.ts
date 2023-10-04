import { Pipe, PipeTransform } from '@angular/core';

import { Filters } from '@/models/pipes';
import { Phunk } from '@/models/graph';

@Pipe({
  standalone: true,
  name: 'filter'
})

export class FilterPipe implements PipeTransform {

  transform(value: Phunk[], ...args: (Filters | null)[]): Phunk[] {

    if (!value?.length) return [];
    if (!args?.length) return value;

    value = [...value];

    value.filter((res) => res.listing?.minValue !== '0' && res.bid?.value !== '0');

    if (args[0] === 'listings') return value.filter((item: any) => item.listing && item.listing.value !== '0');
    if (args[0] === 'bids') return value.filter((item: any) => item.bid && item.bid.value !== '0');

    return value;
  }
}
