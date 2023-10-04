import { AppState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as AppStateActions from '../actions/app-state.action';

export const initialState: AppState = {
  connected: false,
  walletAddress: '',
  hasWithdrawal: false,
  singlePhunk: null,
  marketData: null,
  ownedPhunks: null,
};

export const appStateReducer: ActionReducer<AppState, Action> = createReducer(
  initialState,
  on(AppStateActions.resetAppState, () => initialState),
  // Set the wallet connected
  on(AppStateActions.setConnected, (state, { connected }) => {
    const setConnected = {
      ...state,
      connected,
    };
    // console.log('setConnected', setConnected);
    return setConnected
  }),
  // Set the wallet address
  on(AppStateActions.setWalletAddress, (state, { walletAddress }) => {
    const setWalletAddress = {
      ...state,
      walletAddress: walletAddress.toLowerCase(),
    };
    // console.log('setWalletAddress', setWalletAddress);
    return setWalletAddress
  }),
  // Set the withdrawal status
  on(AppStateActions.setHasWithdrawal, (state, { hasWithdrawal }) => {
    const setHasWithdrawal = {
      ...state,
      hasWithdrawal,
    };
    // console.log('setHasWithdrawal', setHasWithdrawal);
    return setHasWithdrawal
  }),
  on(AppStateActions.setSinglePhunk, (state, { phunk }) => {
    const setSinglePhunk = {
      ...state,
      singlePhunk: phunk,
    };
    // console.log('setSinglePhunk', setSinglePhunk);
    return setSinglePhunk
  }),
  on(AppStateActions.resetSinglePhunk, (state) => {
    const resetSinglePhunk = {
      ...state,
      singlePhunk: null,
    };
    // console.log('resetSinglePhunk', resetSinglePhunk);
    return resetSinglePhunk
  }),
  on(AppStateActions.setMarketData, (state, { marketData }) => {
    const setMarketData = {
      ...state,
      marketData,
    };
    // console.log('setMarketData', setMarketData);
    return setMarketData
  }),
  on(AppStateActions.setOwnedPhunks, (state, { ownedPhunks }) => {
    const setOwnedPhunks = {
      ...state,
      ownedPhunks,
    };
    // console.log('setOwnedPhunks', setOwnedPhunks);
    return setOwnedPhunks
  }),
);
