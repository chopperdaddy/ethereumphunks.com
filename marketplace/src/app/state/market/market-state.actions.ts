import { createAction, props } from '@ngrx/store';

import { Phunk } from '@/models/db';
import { MarketState, MarketType } from '@/models/market.state';
import { TraitFilter } from '@/models/global-state';
import { SortOption } from '@/models/sorts.model';

export const setMarketSlug = createAction(
  '[Market State] Set Market slug',
  props<{ marketSlug: MarketState['marketSlug'] }>()
);

export const setMarketType = createAction(
  '[Market State] Set Market Type',
  props<{ marketType: MarketType }>()
);

export const setActiveSort = createAction(
  '[Market State] Set Active Sort',
  props<{ activeSort: SortOption }>()
);

export const setActiveTraitFilters = createAction(
  '[Market State] Set Active Trait Filters',
  props<{ traitFilters: TraitFilter }>()
);

export const setSelectedPhunks = createAction(
  '[Market State] Set Selected Phunks',
  props<{ selectedPhunks: Phunk[] }>()
);

export const resetMarketState = createAction(
  '[Market State] Reset Market State',
);

export const fetchMarketData = createAction(
  '[Market State] Fetch Market Data',
);

export const setMarketData = createAction(
  '[Market State] Set Market Data',
  props<{ marketData: Phunk[] }>()
);

export const setAuctionData = createAction(
  '[Market State] Set Auction Data',
  props<{ auctionData: Phunk[] }>()
);

export const fetchOwned = createAction(
  '[Market State] Fetch Owned',
);

export const setOwned = createAction(
  '[Market State] Set Owned',
  props<{ owned: Phunk[] }>()
);

export const fetchAll = createAction(
  '[Market State] Fetch All'
);

export const setAll = createAction(
  '[Market State] Set All',
  props<{ all: Phunk[] }>()
);

export const paginateAll = createAction(
  '[Market State] Paginate All',
  props<{ limit: number }>()
);

export const setActiveMarketRouteData = createAction(
  '[Market State] Set Active Market Route Data',
  props<{ activeMarketRouteData: MarketState['activeMarketRouteData'] }>()
);

export const clearActiveMarketRouteData = createAction(
  '[Market State] Clear Active Market Route Data',
);

export const triggerDataRefresh = createAction(
  '[Market State] Trigger Data Refresh'
);

export const setPagination = createAction(
  '[Market State] Set Pagination',
  props<{ pagination: MarketState['pagination'] }>()
);
