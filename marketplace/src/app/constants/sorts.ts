import { MarketType } from '@/models/market.state';
import { MarketSorts, SortOption } from '@/models/sorts.model';

export const marketSorts: MarketSorts = {
  listings: [
    SortOption.PRICE_LOW,
    SortOption.PRICE_HIGH,
    SortOption.RANK_LOW,
    SortOption.RANK_HIGH,
    SortOption.RECENTLY_LISTED,
    SortOption.ID,
  ],
  owned: [
    SortOption.PRICE_LOW,
    SortOption.PRICE_HIGH,
    SortOption.RANK_LOW,
    SortOption.RANK_HIGH,
    SortOption.RECENTLY_LISTED,
    SortOption.ID,
  ],
  all: [
    SortOption.ID,
    SortOption.RANK_LOW,
    SortOption.RANK_HIGH,
  ],
  activity: [
    SortOption.PRICE_LOW,
    SortOption.PRICE_HIGH,
    SortOption.RANK_LOW,
    SortOption.RANK_HIGH,
    SortOption.RECENTLY_LISTED,
    SortOption.ID,
  ],
  auctions: [
    SortOption.RANK_LOW,
    SortOption.RANK_HIGH,
    SortOption.ID,
  ],
};

export const sortLabels = {
  [SortOption.PRICE_LOW]: 'Price Low',
  [SortOption.PRICE_HIGH]: 'Price High',
  [SortOption.RANK_LOW]: 'Rank Low',
  [SortOption.RANK_HIGH]: 'Rank High',
  [SortOption.RECENTLY_LISTED]: 'Recently Listed',
  [SortOption.ID]: 'Token ID',
};

export const defaultSort: Record<MarketType, SortOption> = {
  listings: SortOption.PRICE_LOW,
  owned: SortOption.PRICE_LOW,
  all: SortOption.ID,
  activity: SortOption.RECENTLY_LISTED,
  auctions: SortOption.ID,
};
