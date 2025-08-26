import { Pipe, PipeTransform } from '@angular/core';

import { Phunk } from '@/models/db';
import { SortOption } from '@/models/sorts.model';
import { MarketType } from '@/models/market.state';

@Pipe({
  standalone: true,
  name: 'sort'
})
export class SortPipe implements PipeTransform {

  /**
   * Sort an array of Phunks based on the sort option and market type
   * @param value - The array of Phunks to sort
   * @param args - The sort option and market type
   * @returns The sorted array of Phunks
   */
  transform(value: Phunk[], ...args: [SortOption, MarketType]): Phunk[] {
    if (!value?.length) return [];
    if (!args) return value;

    const sort = args[0];
    const marketType = args[1];

    if (marketType === 'all') return value;

    let sorted = [...value];

    if (sort === SortOption.PRICE_LOW) {
      sorted = sorted.sort((a, b) => this.priceComparison(a, b, true));
    }

    if (sort === SortOption.PRICE_HIGH) {
      sorted = sorted.sort((a, b) => this.priceComparison(a, b, false));
    }

    if (sort === SortOption.RECENTLY_LISTED) {
      sorted = sorted.sort((a, b) => this.dateToNumber(b.listing?.createdAt) - this.dateToNumber(a.listing?.createdAt));
    }

    if (sort === SortOption.RANK_HIGH) {
      // the rank is in the attributes
      sorted = sorted.sort((a, b) => {
        const aRankAttr = a.attributes?.find((attr) => attr.k === 'Rank')?.v;
        const bRankAttr = b.attributes?.find((attr) => attr.k === 'Rank')?.v;

        // Handle missing rank attributes - items without rank go to end
        if (aRankAttr === undefined && bRankAttr === undefined) return 0;
        if (aRankAttr === undefined) return 1; // a has no rank, goes after b
        if (bRankAttr === undefined) return -1; // b has no rank, goes after a

        const aRank = Number(aRankAttr);
        const bRank = Number(bRankAttr);
        return aRank - bRank; // Lower rank numbers first (rank 1 before rank 2)
      });
    }

    if (sort === SortOption.RANK_LOW) {
      sorted = sorted.sort((a, b) => {
        const aRankAttr = a.attributes?.find((attr) => attr.k === 'Rank')?.v;
        const bRankAttr = b.attributes?.find((attr) => attr.k === 'Rank')?.v;

        // Handle missing rank attributes - items without rank go to end
        if (aRankAttr === undefined && bRankAttr === undefined) return 0;
        if (aRankAttr === undefined) return 1; // a has no rank, goes after b
        if (bRankAttr === undefined) return -1; // b has no rank, goes after a

        const aRank = Number(aRankAttr);
        const bRank = Number(bRankAttr);
        return bRank - aRank; // Higher rank numbers first (rank 10000 before rank 1)
      });
    }

    if (sort === SortOption.ID) {
      sorted = sorted.sort((a, b) => a.tokenId - b.tokenId);
    }

    return sorted;
  }

  /**
   * Convert a date string to a number
   * @param date - The date string to convert
   * @returns The number of milliseconds since the Unix epoch
   */
  private dateToNumber = (date: string | undefined): number => {
    if (!date) return 0;
    return new Date(date).getTime();
  };

  /**
   * Compare two Phunks based on their price
   * @param a - The first Phunk
   * @param b - The second Phunk
   * @param isLowToHigh - Whether to sort in low-to-high order
   * @returns A number indicating the order of the two Phunks
   */
  private priceComparison = (a: Phunk, b: Phunk, isLowToHigh: boolean) => {
    const aPrice = Number(a.listing?.minValue || '0');
    const bPrice = Number(b.listing?.minValue || '0');

    // Items without prices should always be last
    if (!aPrice && !bPrice) return 0; // Both have no price, maintain order
    if (!aPrice) return 1; // a has no price, should come after b
    if (!bPrice) return -1; // b has no price, should come after a

    // Both have prices, sort normally
    return isLowToHigh ? aPrice - bPrice : bPrice - aPrice;
  };
}
