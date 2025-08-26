import { MarketType } from './market.state';

export type MarketSorts = { [key in MarketType]: SortOption[] }

export enum SortOption {
  PRICE_LOW = 'price-low',
  PRICE_HIGH = 'price-high',
  RANK_HIGH = 'rank-high',
  RANK_LOW = 'rank-low',
  ID = 'id',
  RECENTLY_LISTED = 'recently-listed',
}
