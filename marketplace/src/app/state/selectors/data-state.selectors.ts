import { DataState } from '@/models/data.state';
import { GlobalState } from '@/models/global-state';
import { createSelector } from '@ngrx/store';

export const selectDataState = (state: GlobalState) => state.dataState;

export const selectUsd = createSelector(
  selectDataState,
  (appState: DataState) => appState.usd
);

export const selectSinglePhunk = createSelector(
  selectDataState,
  (appState: DataState) => appState.singlePhunk
);

export const selectMarketData = createSelector(
  selectDataState,
  (appState: DataState) => appState.marketData
);

export const selectOwnedPhunks = createSelector(
  selectDataState,
  (appState: DataState) => appState.ownedPhunks
);

export const selectAllPhunks = createSelector(
  selectDataState,
  (appState: DataState) => appState.allPhunks
);

export const selectListings = createSelector(
  selectDataState,
  (appState: DataState) => appState.listings
);

export const selectBids = createSelector(
  selectDataState,
  (appState: DataState) => appState.bids
);

export const selectEvents = createSelector(
  selectDataState,
  (appState: DataState) => appState.events
);

export const selectTxHistory = createSelector(
  selectDataState,
  (appState: DataState) => appState.txHistory
);

export const selectUserOpenBids = createSelector(
  selectDataState,
  (appState: DataState) => appState.userOpenBids
);

export const selectActiveMarketRouteData = createSelector(
  selectDataState,
  (appState: DataState) => appState.activeMarketRouteData
);

export const selectLeaderboard = createSelector(
  selectDataState,
  (appState: DataState) => appState.leaderboard
);
