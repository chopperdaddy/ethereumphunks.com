import { Phunk } from './db';

export interface MarketState {
  marketType: MarketType | null;
  marketSlug: string;

  marketData: Phunk[];
  owned: Phunk[];
  listings: Phunk[];
  bids: Phunk[];
  all: Phunk[];
  activeMarketRouteData: Phunk[];

  selectedPhunks: Phunk[];

  activeSort: { label: 'Price Low', value: 'price-low' };
  activeTraitFilters: any;

  pagination: PaginationState;
}

export type MarketType = 'listings' | 'bids' | 'owned' | 'all';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
};
