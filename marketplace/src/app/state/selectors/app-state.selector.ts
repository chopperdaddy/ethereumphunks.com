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

export const selectAllPhunks = createSelector(
  selectAppState,
  (appState: AppState) => appState.allPhunks
);

export const selectMarketType = createSelector(
  selectAppState,
  (appState: AppState) => appState.marketType
);

export const selectActiveSort = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeSort
);

// export const selectActiveFilters = createSelector(
//   selectAppState,
//   (appState: AppState) => appState.activeFilters
// );

export const selectListings = createSelector(
  selectAppState,
  (appState: AppState) => appState.listings
);

export const selectBids = createSelector(
  selectAppState,
  (appState: AppState) => appState.bids
);

export const selectEvents = createSelector(
  selectAppState,
  (appState: AppState) => appState.events
);

export const selectActiveEventType = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeEventType
);

export const selectTxHistory = createSelector(
  selectAppState,
  (appState: AppState) => appState.txHistory
);

export const selectActiveTraitFilters = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeTraitFilters
);

export const selectSelectedPhunks = createSelector(
  selectAppState,
  (appState: AppState) => appState.selectedPhunks
);

export const selectMenuActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.menuActive
);

export const selectTheme = createSelector(
  selectAppState,
  (appState: AppState) => appState.theme
);

export const selectTransactions = createSelector(
  selectAppState,
  (appState: AppState) => appState.transactions
);

export const selectIsMobile = createSelector(
  selectAppState,
  (appState: AppState) => appState.isMobile
);

export const selectCooldowns = createSelector(
  selectAppState,
  (appState: AppState) => appState.cooldowns
);
