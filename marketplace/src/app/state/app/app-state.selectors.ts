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

export const selectIsBanned = createSelector(
  selectAppState,
  (appState: AppState) => appState.isBanned
);

// export const selectActiveFilters = createSelector(
//   selectAppState,
//   (appState: AppState) => appState.activeFilters
// );

export const selectScrollPositions = createSelector(
  selectAppState,
  (appState: AppState) => appState.scrollPositions
);

export const selectEventTypeFilter = createSelector(
  selectAppState,
  (appState: AppState) => appState.eventTypeFilter
);

export const selectEventPage = createSelector(
  selectAppState,
  (appState: AppState) => appState.eventPage
);

export const selectMenuActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.menuActive
);

export const selectActiveMenuNav = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeMenuNav
);

export const selectSlideoutActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.slideoutActive
);

export const selectTheme = createSelector(
  selectAppState,
  (appState: AppState) => appState.theme
);

export const selectIsMobile = createSelector(
  selectAppState,
  (appState: AppState) => appState.isMobile
);

export const selectIsBrowserActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.isBrowserActive
);

export const selectCooldowns = createSelector(
  selectAppState,
  (appState: AppState) => appState.cooldowns
);

export const selectCurrentBlock = createSelector(
  selectAppState,
  (appState: AppState) => appState.currentBlock
);

export const selectIndexerBlock = createSelector(
  selectAppState,
  (appState: AppState) => appState.indexerBlock
);

export const selectBlocksBehind = createSelector(
  selectAppState,
  (appState: AppState) => appState.blocksBehind
);

export const selectIndexerIsBehind = createSelector(
  selectAppState,
  (appState: AppState) => appState.blocksBehind > 3
);

export const selectUserPoints = createSelector(
  selectAppState,
  (appState: AppState) => appState.userPoints
);

export const selectActiveMultiplier = createSelector(
  selectAppState,
  (appState: AppState) => appState.activeMultiplier
);

export const selectSearchHistory = createSelector(
  selectAppState,
  (appState: AppState) => appState.searchHistory
);

export const selectSearchHistoryActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.searchHistoryActive
);

export const selectIsSearchResult = createSelector(
  selectAppState,
  (appState: AppState) => appState.isSearchResult
);

export const selectCollectionsMenuActive = createSelector(
  selectAppState,
  (appState: AppState) => appState.collectionsMenuActive
);

export const selectConfig = createSelector(
  selectAppState,
  (appState: AppState) => appState.config
);

export const selectLinkedAccounts = createSelector(
  selectAppState,
  (appState: AppState) => appState.linkedAccounts
);

export const selectAdvancedMode = createSelector(
  selectAppState,
  (appState: AppState) => appState.advancedMode
);
