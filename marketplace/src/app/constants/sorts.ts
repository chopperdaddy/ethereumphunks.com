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
