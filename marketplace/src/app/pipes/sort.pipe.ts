import { Pipe, PipeTransform } from '@angular/core';

import { Phunk } from '@/models/db';
import { SortOption } from '@/models/sorts.model';
import { MarketType } from '@/models/market.state';

@Pipe({
  standalone: true,
  name: 'sort'
})
export class SortPipe implements PipeTransform {
  transform(value: Phunk[], ...args: [SortOption, MarketType]): Phunk[] {
    if (!value?.length) return [];
    if (!args) return value;

    const sort = args[0];
    const marketType = args[1];
    if (marketType === 'all') return value;

    let sorted = [...value];

    const dateToNumber = (date: string | undefined): number => {
      if (!date) return 0;
      return new Date(date).getTime();
    };

    const priceComparison = (a: Phunk, b: Phunk, isLowToHigh: boolean) => {
      const aPrice = Number(a.listing?.minValue || '0');
      const bPrice = Number(b.listing?.minValue || '0');
      const aVal = aPrice ? aPrice : Infinity;
      const bVal = bPrice ? bPrice : Infinity;
      return isLowToHigh ? aVal - bVal : bVal - aVal;
    };

    if (sort === SortOption.PRICE_LOW) {
      sorted = sorted.sort((a, b) => priceComparison(a, b, true));
    }

    if (sort === SortOption.PRICE_HIGH) {
      sorted = sorted.sort((a, b) => priceComparison(a, b, false));
    }

    if (sort === SortOption.RECENTLY_LISTED) {
      sorted = sorted.sort((a, b) => dateToNumber(b.listing?.createdAt) - dateToNumber(a.listing?.createdAt));
    }

    if (sort === SortOption.RANK_HIGH) {
      // the rank is in the attributes
      sorted = sorted.sort((a, b) => {
        const aRank = Number((a.attributes?.find((attr) => attr.k === 'Rank'))?.v || 0);
        const bRank = Number((b.attributes?.find((attr) => attr.k === 'Rank'))?.v || 0);
        if (!aRank || !bRank) return 0;
        return aRank - bRank;
      });
    }

    if (sort === SortOption.RANK_LOW) {
      sorted = sorted.sort((a, b) => {
        const aRank = Number((a.attributes?.find((attr) => attr.k === 'Rank'))?.v || 0);
        const bRank = Number((b.attributes?.find((attr) => attr.k === 'Rank'))?.v || 0);
        if (!aRank || !bRank) return 0;
        return bRank - aRank;
      });
    }

    if (sort === SortOption.ID) {
      sorted = sorted.sort((a, b) => a.tokenId - b.tokenId);
    }

    return sorted;
  }
}
