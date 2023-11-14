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

export const selectactiveEventTypeFilter = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeEventTypeFilter
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

export const selectBlockNumber = createSelector(
  selectAppState,
  (appState: AppState) => appState.blockNumber
);
