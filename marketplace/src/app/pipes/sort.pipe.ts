import { Pipe, PipeTransform } from '@angular/core';

import { Phunk } from '@/models/db';

@Pipe({
  standalone: true,
  name: 'sort'
})

export class SortPipe implements PipeTransform {

  transform(value: Phunk[], ...args: any): Phunk[] {
    if (!value?.length) return [];
    if (!args) return value;

    const sort = args[0]?.value;
    const type = args[1];

    // console.log({ sort, type })

    let sorted = [ ...value ];

    const dateToNumber = (date: Date | undefined): number => {
      if (!date) return 0;
      return new Date(date).getTime();
    }

    if (sort === 'price-low') {
      if (type === 'listings' || type === 'owned') sorted = value.sort((a: Phunk, b: Phunk) => Number(a.listing?.minValue || '0') - Number(b.listing?.minValue || '0'));
      if (type === 'bids') sorted = value.sort((a: Phunk, b: Phunk) => Number(a.bid?.value || '0') - Number(b.bid?.value || '0'));
    }

    if (sort === 'price-high') {
      if (type === 'listings' || type === 'owned') sorted = value.sort((a: Phunk, b: Phunk) => Number(b.listing?.minValue || '0') - Number(a.listing?.minValue || '0'));
      if (type === 'bids') sorted = value.sort((a: Phunk, b: Phunk) => Number(b.bid?.value || '0') - Number(a.bid?.value || '0'));
    }

    if (sort === 'recent') {
      // console.log(args)
      // console.log({ value })
      if (type === 'listings' || type === 'owned') sorted = value.sort((a: Phunk, b: Phunk) => dateToNumber(b.listing?.createdAt) - dateToNumber(a.listing?.createdAt));
      if (type === 'bids') sorted = value.sort((a: Phunk, b: Phunk) => dateToNumber(b.bid?.createdAt) - dateToNumber(a.bid?.createdAt));
    }

    if (sort === 'id') sorted = value.sort((a: Phunk, b: Phunk) => a.phunkId - b.phunkId);

    return sorted;
  }
}
