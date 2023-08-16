import { Pipe, PipeTransform } from '@angular/core';

import { Filters, WrappedFilters } from '@/models/pipes';
import { Punk } from '@/models/graph';

@Pipe({
  standalone: true,
  name: 'filter'
})

export class FilterPipe implements PipeTransform {

  transform(value: Punk[], ...args: (Filters | WrappedFilters | null)[]): Punk[] {

    if (!value?.length) return [];
    if (!args?.length) return value;

    value = [...value];

    value.filter((res) => res.listing?.value !== '0' && res.bid?.value !== '0');

    if (args[1]) {
      if (args[1] === 'Wrapped') value = value.filter((item: any) => item.wrapped);
      if (args[1] === 'Unwrapped') value = value.filter((item: any) => !item.wrapped);
    }

    if (args[0] === 'listings') return value.filter((item: any) => item.listing && item.listing.value !== '0');
    if (args[0] === 'bids') return value.filter((item: any) => item.bid && item.bid.value !== '0');

    return value;
  }
}
