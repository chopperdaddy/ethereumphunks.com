import { createAction, props } from '@ngrx/store';

import { MarketState, MarketType } from '@/models/market.state';
import { Phunk } from '@/models/db';
import { Sort } from '@/models/pipes';

export const setActiveSort = createAction(
  '[Market State] Set Active Sort',
  props<{ activeSort: MarketState['activeSort'] }>()
);

export const addRemoveTraitFilter = createAction(
  '[Market State] Add Trait Filter',
  props<{ traitFilter: any }>()
);

export const setActiveTraitFilters = createAction(
  '[Market State] Set Active Trait Filters',
  props<{ activeTraitFilters: any }>()
);

export const clearActiveTraitFilters = createAction(
  '[Market State] Clear Active Trait Filters',
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

export const setPageSize = createAction(
  '[Market State] Set Page Size',
  props<{ pageSize: number }>()
);

export const setCurrentPage = createAction(
  '[Market State] Set Current Page',
  props<{ currentPage: number }>()
);

export const setHasMore = createAction(
  '[Market State] Set Has More',
  props<{ hasMore: boolean }>()
);

export const setIsLoading = createAction(
  '[Market State] Set Is Loading',
  props<{ isLoading: boolean }>()
);

export const setPagination = createAction(
  '[Market State] Set Pagination',
  props<{ pagination: MarketState['pagination'] }>()
);

export const setPaginationPartial = createAction(
  '[Market State] Set Pagination Partial',
  props<{ partial: Partial<MarketState['pagination']> }>()
);

export const resetPagination = createAction(
  '[Market State] Reset Pagination'
);
