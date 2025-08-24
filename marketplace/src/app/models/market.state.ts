import { Auction, Phunk } from './db';
import { TraitFilter } from './global-state';
import { Sort } from './pipes';

export interface MarketState {
  marketType: MarketType | null;
  marketSlug: string;

  marketData: Phunk[];
  owned: Phunk[];
  listings: Phunk[];
  bids: Phunk[];
  all: Phunk[];
  auctions: Phunk[];
  activeMarketRouteData: {
    data: Phunk[];
    total: number;
  };
  pagination: PaginationState;

  selectedPhunks: Phunk[];

  activeSort: Sort;
  activeTraitFilters: TraitFilter | null;
}

export type MarketType = 'listings' | 'bids' | 'owned' | 'all' | 'activity' | 'auctions';

export interface PaginationState {
  fromIndex: number;
  toIndex: number;
};
