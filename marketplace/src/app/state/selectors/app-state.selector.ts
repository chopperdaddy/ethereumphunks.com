import { createSelector } from '@ngrx/store';

import { GlobalState, AppState } from '@/models/global-state';

export const selectAppState = (state: GlobalState) => state.appState;

export const selectConnected = createSelector(
  selectAppState,
  (appState: AppState) => appState.connected
);

export const selectWalletAddress = createSelector(
  selectAppState,
  (appState: AppState) => appState.walletAddress
);

export const selectHasWithdrawal = createSelector(
  selectAppState,
  (appState: AppState) => appState.hasWithdrawal
);

export const selectSinglePhunk = createSelector(
  selectAppState,
  (appState: AppState) => appState.singlePhunk
);

export const selectMarketData = createSelector(
  selectAppState,
  (appState: AppState) => appState.marketData
);

export const selectOwnedPhunks = createSelector(
  selectAppState,
  (appState: AppState) => appState.ownedPhunks
);
