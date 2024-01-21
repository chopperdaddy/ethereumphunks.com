import { createAction, props } from '@ngrx/store';

import { MarketState, MarketType } from '@/models/market.state';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';

export const setActiveSort = createAction(
  '[Market State] Set Active Sort',
  props<{ activeSort: MarketState['activeSort'] }>()
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

export const setMarketType = createAction(
  '[Market State] Set Market Type',
  props<{ marketType: MarketType }>()
);

export const setMarketSlug = createAction(
  '[Market State] Set Market slug',
  props<{ marketSlug: MarketState['marketSlug'] }>()
);

export const fetchMarketData = createAction(
  '[Market State] Fetch Market Data',
);

export const setMarketData = createAction(
  '[Market State] Set Market Data',
  props<{ marketData: Phunk[] }>()
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
  '[Data State] Trigger Data Refresh'
);

export const setPagination = createAction(
  '[Market State] Set Pagination',
  props<{ pagination: MarketState['pagination'] }>()
);
