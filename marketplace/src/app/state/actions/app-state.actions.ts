import { Phunk } from '@/models/graph';

import { createAction, props } from '@ngrx/store';

import { MarketTypes, Sorts } from '@/models/pipes';
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
  props<{ hasWithdrawal: boolean }>()
);

export const resetAppState = createAction(
  '[App State] Reset App State'
);

export const setEventType = createAction(
  '[Data State] Set Event Type',
  props<{ eventType: EventType }>()
);

export const setMarketType = createAction(
  '[Market] Set Market Type',
  props<{ marketType: MarketTypes }>()
);

export const setActiveSort = createAction(
  '[Market] Set Active Sort',
  props<{ activeSort: Sorts }>()
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

export const setTheme = createAction(
  '[App State] Set Theme',
  props<{ theme: AppState['theme'] }>()
);

export const addTransaction = createAction(
  '[App State] Add Transaction',
  props<{ transaction: Transaction }>()
);

export const removeTransaction = createAction(
  '[App State] Remove Transaction',
  props<{ txId: Transaction['id'] }>()
);

export const clearTransactions = createAction(
  '[App State] Clear Transactions',
);

export const upsertTransaction = createAction(
  '[App State] Upsert Transaction',
  props<{ transaction: Transaction }>()
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
