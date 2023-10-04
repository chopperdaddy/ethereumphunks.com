import { Phunk } from '@/models/graph';
import { createAction, props } from '@ngrx/store';

export const setConnected = createAction(
  '[App State] Set Wallet Connected',
  props<{ connected: boolean }>()
);

export const setWalletAddress = createAction(
  '[App State] Set Wallet Address',
  props<{ walletAddress: string }>()
);

export const setHasWithdrawal = createAction(
  '[App State] Has Withdrawal',
  props<{ hasWithdrawal: boolean }>()
);

export const resetAppState = createAction(
  '[App State] Reset App State'
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

export const resetSinglePhunk = createAction(
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

export const setOwnedPhunks = createAction(
  '[App State] Set Owned Phunks',
  props<{ ownedPhunks: Phunk[] }>()
);
