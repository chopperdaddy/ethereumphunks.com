import { createAction, props } from '@ngrx/store';

import { AppState, Cooldowns, EventType, GlobalConfig, HistoryItem, LinkedAccount } from '@/models/global-state';

export const setConnected = createAction(
  '[App State] Set Wallet Connected',
  props<{ connected: boolean }>()
);

export const setWalletAddress = createAction(
  '[App State] Set Wallet Address',
  props<{ walletAddress: string | undefined }>()
);

export const checkHasWithdrawal = createAction(
  '[App State] Check Has Withdrawal'
);

export const setHasWithdrawal = createAction(
  '[App State] Has Withdrawal',
  props<{ hasWithdrawal: number }>()
);

export const setIsBanned = createAction(
  '[App State] Set Is Banned',
  props<{ isBanned: boolean }>()
);

export const resetAppState = createAction(
  '[App State] Reset App State'
);

export const setEventTypeFilter = createAction(
  '[Data State] Set Event Type',
  props<{ eventTypeFilter: EventType }>()
);

export const setEventPage = createAction(
  '[App State] Set Event Page',
  props<{ page: number }>()
);

export const setMenuActive = createAction(
  '[App State] Set Menu Active',
  props<{ menuActive: AppState['menuActive'] }>()
);

export const setActiveMenuNav = createAction(
  '[App State] Set Active Menu Nav',
  props<{ activeMenuNav: AppState['activeMenuNav'] }>()
);

export const setSlideoutActive = createAction(
  '[App State] Set Slideout Active',
  props<{ slideoutActive: AppState['slideoutActive'] }>()
);

export const setTheme = createAction(
  '[App State] Set Theme',
  props<{ theme: AppState['theme'] }>()
);

export const setIsMobile = createAction(
  '[App State] Set Is Mobile',
  props<{ isMobile: boolean }>()
);

export const setBrowserActive = createAction(
  '[App State] Set Browser Active',
  props<{ isBrowserActive: boolean }>()
);

export const keyDownEscape = createAction(
  '[App State] Keydown Escape'
);

export const clickEvent = createAction(
  '[App State] Click Event',
  props<{ event: MouseEvent }>()
);

export const addCooldown = createAction(
  '[App State] Add Cooldown',
  props<{ cooldown: Cooldowns }>()
);

export const setCooldowns = createAction(
  '[App State] Set Cooldowns',
  props<{ cooldowns: Cooldowns }>()
);

export const setCurrentBlock = createAction(
  '[App State] Set Current Block',
  props<{ currentBlock: number }>()
);

export const setIndexerBlock = createAction(
  '[App State] Set Indexer Block',
  props<{ indexerBlock: number }>()
);

export const mouseUp = createAction(
  '[App State] Mouse Up',
  props<{ event: MouseEvent }>()
);

export const mouseDown = createAction(
  '[App State] Mouse Down',
  props<{ event: MouseEvent }>()
);

export const pointsChanged = createAction(
  '[App State] Points Changed',
  props<{ log: any }>()
);

export const fetchUserPoints = createAction(
  '[App State] Fetch User Points',
  props<{ address: string | undefined }>()
);

export const setUserPoints = createAction(
  '[App State] Set User Points',
  props<{ userPoints: number }>()
);

export const fetchActiveMultiplier = createAction(
  '[App State] Fetch Active Multiplier'
);

export const setActiveMultiplier = createAction(
  '[App State] Set Active Multiplier',
  props<{ activeMultiplier: number }>()
);

export const restoreScrollPosition = createAction(
  '[Router] Restore Scroll Position',
  props<{ navigationId: number }>()
);

export const setSearchHistory = createAction(
  '[App State] Set Search History',
  props<{ searchHistory: AppState['searchHistory'] }>()
);

export const addSearchHistory = createAction(
  '[App State] Add Search History',
  props<{ item: HistoryItem }>()
);

export const clearSearchHistory = createAction(
  '[App State] Clear Search History'
);

export const removeSearchHistory = createAction(
  '[App State] Remove Search History',
  props<{ index: number }>()
);

export const setSearchHistoryActive = createAction(
  '[App State] Set Search History Active',
  props<{ searchHistoryActive: boolean }>()
);

export const setIsSearchResult = createAction(
  '[App State] Set Is Search Result',
  props<{ isSearchResult: boolean }>()
);

export const setCollectionsMenuActive = createAction(
  '[App State] Set Collections Menu Active',
  props<{ collectionsMenuActive: boolean }>()
);

export const initGlobalConfig = createAction(
  '[App State] Init Global Config'
);

export const setGlobalConfig = createAction(
  '[App State] Set Global Config State',
  props<{ config: GlobalConfig }>()
);

export const setLinkedAccounts = createAction(
  '[App State] Set Linked Accounts',
  props<{ linkedAccounts: LinkedAccount[] }>()
);

export const addLinkedAccount = createAction(
  '[App State] Add Linked Account',
  props<{ linkedAccount: LinkedAccount | undefined }>()
);

export const setAdvancedMode = createAction(
  '[App State] Set Advanced Mode',
  props<{ advancedMode: boolean }>()
);
