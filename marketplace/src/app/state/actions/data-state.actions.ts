import { EventType } from '@/models/global-state';
import { createAction, props } from '@ngrx/store';

import { Phunk } from '@/models/db';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { DataState } from '@/models/data.state';

export const resetDataState = createAction(
  '[Data State] Reset Data State'
);

export const setUsd = createAction(
  '[Data State] Set USD',
  props<{ usd: number }>()
);

export const fetchEvents = createAction(
  '[Data State] Fetch Events',
  props<{ eventType: EventType }>()
);

export const setEvents = createAction(
  '[Data State] Set Events',
  props<{ events: any[] }>()
);

export const fetchAllPhunks = createAction(
  '[Data State] Fetch All Phunks'
);

export const setAllPhunks = createAction(
  '[Data State] Set All Phunks',
  props<{ allPhunks: Phunk[] }>()
);

export const fetchSinglePhunk = createAction(
  '[Data State] Fetch Single Phunk',
  props<{ phunkId: string }>()
);

export const setSinglePhunk = createAction(
  '[Data State] Set Single Phunk',
  props<{ phunk: Phunk }>()
);

export const refreshSinglePhunk = createAction(
  '[Data State] Refresh Phunk',
);

export const clearSinglePhunk = createAction(
  '[Data State] Reset Single Phunk',
);

export const fetchMarketData = createAction(
  '[Data State] Fetch Market Data'
);

export const setMarketData = createAction(
  '[Data State] Set Market Data',
  props<{ marketData: Phunk[] }>()
);

export const fetchOwnedPhunks = createAction(
  '[Data State] Fetch Owned Phunks'
);

export const fetchTxHistory = createAction(
  '[Data State] Fetch Tx History',
  props<{ hashId: string }>()
);

export const setTxHistory = createAction(
  '[Data State] Set Tx History',
  props<{ txHistory: any[] | null }>()
);

export const clearTxHistory = createAction(
  '[Data State] Clear Tx History',
);

export const setOwnedPhunks = createAction(
  '[Data State] Set Owned Phunks',
  props<{ ownedPhunks: Phunk[] }>()
);

export const dbEventTriggered = createAction(
  '[Data State] DB Event Triggered',
  props<{ payload: RealtimePostgresChangesPayload<{ [key: string]: any; }> }>()
);

export const setActiveMarketRouteData = createAction(
  '[Data State] Set Active Market Route Data',
  props<{ activeMarketRouteData: DataState['activeMarketRouteData'] }>()
);

export const clearActiveMarketRouteData = createAction(
  '[Data State] Clear Active Market Route Data',
);

export const setListings = createAction(
  '[Market] Set Listings',
  props<{ listings: Phunk[] }>()
);

export const setBids = createAction(
  '[Market] Set Bids',
  props<{ bids: Phunk[] }>()
);

export const fetchUserOpenBids = createAction(
  '[Data State] Fetch User Open Bids'
);

export const setUserOpenBids = createAction(
  '[Data State] Set User Open Bids',
  props<{ userOpenBids: Phunk[] }>()
);

export const fetchLeaderboard = createAction(
  '[Data State] Fetch Leaderboard'
);

export const setLeaderboard = createAction(
  '[Data State] Set Leaderboard',
  props<{ leaderboard: any[] }>()
);
