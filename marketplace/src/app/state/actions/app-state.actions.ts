import { Phunk } from '@/models/db';

import { createAction, props } from '@ngrx/store';

import { MarketTypes, Sort, Sorts } from '@/models/pipes';
import { AppState, EventType, Transaction } from '@/models/global-state';

export const setConnected = createAction(
  '[App State] Set Wallet Connected',
  props<{ connected: boolean }>()
);

export const setWalletAddress = createAction(
  '[App State] Set Wallet Address',
  props<{ walletAddress: string }>()
);

export const checkHasWithdrawal = createAction(
  '[App State] Check Has Withdrawal'
);

export const setHasWithdrawal = createAction(
  '[App State] Has Withdrawal',
  props<{ hasWithdrawal: number }>()
);

export const resetAppState = createAction(
  '[App State] Reset App State'
);

export const setEventTypeFilter = createAction(
  '[Data State] Set Event Type',
  props<{ eventTypeFilter: EventType }>()
);

export const setMarketType = createAction(
  '[Market] Set Market Type',
  props<{ marketType: MarketTypes }>()
);

export const setActiveSort = createAction(
  '[Market] Set Active Sort',
  props<{ activeSort: Sort }>()
);

export const addRemoveTraitFilter = createAction(
  '[Market] Add Trait Filter',
  props<{ traitFilter: any }>()
);

export const setActiveTraitFilters = createAction(
  '[Market] Set Active Trait Filters',
  props<{ activeTraitFilters: any }>()
);

export const clearActiveTraitFilters = createAction(
  '[Market] Clear Active Trait Filters',
);

export const setSelectedPhunks = createAction(
  '[Market] Set Selected Phunks',
  props<{ selectedPhunks: Phunk[] }>()
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

export const clearTransactions = createAction(
  '[App State] Clear Transactions',
);

export const upsertTransaction = createAction(
  '[App State] Upsert Transaction',
  props<{ transaction: Transaction }>()
);

export const removeTransaction = createAction(
  '[App State] Remove Transaction',
  props<{ txId: Transaction['id'] }>()
);

export const setTransactions = createAction(
  '[App State] Set Transactions',
  props<{ transactions: Transaction[] }>()
);

export const setIsMobile = createAction(
  '[App State] Set Is Mobile',
  props<{ isMobile: boolean }>()
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
  props<{ cooldown: AppState['cooldowns'][0] }>()
);

export const removeCooldown = createAction(
  '[App State] Remove Cooldown',
  props<{ phunkId: number }>()
);

export const newBlock = createAction(
  '[App State] New Block',
  props<{ blockNumber: number }>()
);

export const mouseUp = createAction(
  '[App State] Mouse Up',
  props<{ event: MouseEvent }>()
);

export const fetchUserPoints = createAction(
  '[App State] Fetch User Points'
);

export const setUserPoints = createAction(
  '[App State] Set User Points',
  props<{ userPoints: number }>()
);

export const restoreScrollPosition = createAction(
  '[Router] Restore Scroll Position',
  props<{ navigationId: number }>()
);

export const setNotifHoverState = createAction(
  '[App State] Set Notif Hover State',
  props<{ notifHoverState: AppState['notifHoverState'] }>()
);
