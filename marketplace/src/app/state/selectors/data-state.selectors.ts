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

export const selectEvents = createSelector(
  selectDataState,
  (appState: DataState) => appState.events
);

export const selectUserOpenBids = createSelector(
  selectDataState,
  (appState: DataState) => appState.userOpenBids
);

export const selectLeaderboard = createSelector(
  selectDataState,
  (appState: DataState) => appState.leaderboard
);

export const selectCollections = createSelector(
  selectDataState,
  (appState: DataState) => appState.collections
);

export const selectActiveCollection = createSelector(
  selectDataState,
  (appState: DataState) => appState.activeCollection
);
