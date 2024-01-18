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

    const sort = args[0];
    const type = args[1];

    let sorted = [...value];

    const dateToNumber = (date: Date | undefined): number => {
      if (!date) return 0;
      return new Date(date).getTime();
    };

    const priceComparison = (a: Phunk, b: Phunk, isLowToHigh: boolean) => {
      const aPrice = type === 'bids' ? Number(a.bid?.value || '0') : Number(a.listing?.minValue || '0');
      const bPrice = type === 'bids' ? Number(b.bid?.value || '0') : Number(b.listing?.minValue || '0');
      const aVal = aPrice ? aPrice : Infinity;
      const bVal = bPrice ? bPrice : Infinity;
      return isLowToHigh ? aVal - bVal : bVal - aVal;
    };

    if (sort === 'price-low') {
      sorted = sorted.sort((a, b) => priceComparison(a, b, true));
    }

    if (sort === 'price-high') {
      sorted = sorted.sort((a, b) => priceComparison(a, b, false));
    }

    // if (sort === 'recent') {
    //   if (type === 'listings') {
    //     sorted = sorted.sort((a, b) => dateToNumber(b.listing?.createdAt) - dateToNumber(a.listing?.createdAt));
    //   } else if (type === 'bids') {
    //     sorted = sorted.sort((a, b) => dateToNumber(b.bid?.createdAt) - dateToNumber(a.bid?.createdAt));
    //   }
    // }

    if (sort === 'id') {
      sorted = sorted.sort((a, b) => a.tokenId - b.tokenId);
    }

    return sorted;
  }
}
