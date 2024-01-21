import { Phunk } from './db';
import { TraitFilter } from './global-state';

export interface MarketState {
  marketType: MarketType | null;
  marketSlug: string;

  marketData: Phunk[];
  owned: Phunk[];
  listings: Phunk[];
  bids: Phunk[];
  all: Phunk[];

  activeMarketRouteData: {
    data: Phunk[];
    total: number;
  };
  pagination: PaginationState;

  selectedPhunks: Phunk[];

  activeSort: { label: 'Price Low', value: 'price-low' };
  activeTraitFilters: TraitFilter | null;
}

export type MarketType = 'listings' | 'bids' | 'owned' | 'all';

export interface PaginationState {
  fromIndex: number;
  toIndex: number;
};
