import { Phunk } from '@/models/graph';

import { createAction, props } from '@ngrx/store';

import { MarketTypes, Sorts } from '@/models/pipes';
import { AppState, EventType, GlobalState, TxFilterItem } from '@/models/global-state';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { TX, ModalState, TxType } from '@/models/transaction';

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

export const fetchEvents = createAction(
  '[App State] Fetch Events',
  props<{ eventType: EventType }>()
);

export const setEvents = createAction(
  '[App State] Set Events',
  props<{ events: any[] }>()
);

export const setEventType = createAction(
  '[App State] Set Event Type',
  props<{ eventType: EventType }>()
);

export const fetchAllPhunks = createAction(
  '[App State] Fetch All Phunks'
);

export const setAllPhunks = createAction(
  '[App State] Set All Phunks',
  props<{ allPhunks: Phunk[] }>()
);

export const fetchSinglePhunk = createAction(
  '[App State] Fetch Single Phunk',
  props<{ phunkId: string }>()
);

export const setSinglePhunk = createAction(
  '[App State] Set Single Phunk',
  props<{ phunk: Phunk }>()
);

export const refreshSinglePhunk = createAction(
  '[App State] Refresh Phunk',
);

export const clearSinglePhunk = createAction(
  '[App State] Reset Single Phunk',
);

export const fetchMarketData = createAction(
  '[App State] Fetch Market Data'
);

export const setMarketData = createAction(
  '[App State] Set Market Data',
  props<{ marketData: Phunk[] }>()
);

export const fetchOwnedPhunks = createAction(
  '[App State] Fetch Owned Phunks'
);

export const fetchTxHistory = createAction(
  '[App State] Fetch Tx History',
  props<{ hashId: string }>()
);

export const setTxHistory = createAction(
  '[App State] Set Tx History',
  props<{ txHistory: any[] | null }>()
);

export const clearTxHistory = createAction(
  '[App State] Clear Tx History',
);

export const setOwnedPhunks = createAction(
  '[App State] Set Owned Phunks',
  props<{ ownedPhunks: Phunk[] }>()
);

export const dbEventTriggered = createAction(
  '[App State] DB Event Triggered',
  props<{ payload: RealtimePostgresChangesPayload<{ [key: string]: any; }> }>()
);

export const setActiveMarketRouteData = createAction(
  '[App State] Set Active Market Route Data',
  props<{ activeMarketRouteData: Phunk[] }>()
);

export const clearActiveMarketRouteData = createAction(
  '[App State] Clear Active Market Route Data',
);

export const setMarketType = createAction(
  '[Market] Set Market Type',
  props<{ marketType: MarketTypes }>()
);

export const setActiveSort = createAction(
  '[Market] Set Active Sort',
  props<{ activeSort: Sorts }>()
);

export const setListings = createAction(
  '[Market] Set Listings',
  props<{ listings: Phunk[] }>()
);

export const setBids = createAction(
  '[Market] Set Bids',
  props<{ bids: Phunk[] }>()
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

export const sendTransaction = createAction(
  '[App State] Send Transaction',
  props<{ tx: TX }>()
);
