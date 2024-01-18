import { GlobalState } from '@/models/global-state';
import { MarketState } from '@/models/market.state';
import { createSelector } from '@ngrx/store';

export const selectMarketState = (state: GlobalState) => state.marketState;

export const selectActiveSort = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.activeSort
);

export const selectActiveTraitFilters = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.activeTraitFilters
);

export const selectSelectedPhunks = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.selectedPhunks
);

export const selectActiveMarketRouteData = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.activeMarketRouteData
);

export const selectMarketType = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.marketType
);

export const selectMarketSlug = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.marketSlug
);

export const selectMarketData = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.marketData
);

export const selectOwned = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.owned
);

export const selectAll = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.all
);

export const selectListings = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.listings
);

export const selectBids = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.bids
);

export const selectPagination = createSelector(
  selectMarketState,
  (appState: MarketState) => appState.pagination
);
