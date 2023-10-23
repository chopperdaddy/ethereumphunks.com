import { AppState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as AppStateActions from '../actions/app-state.action';

export const initialState: AppState = {
  connected: false,
  walletAddress: '',
  hasWithdrawal: false,

  events: null,
  allPhunks: null,
  singlePhunk: null,
  marketData: null,
  listings: null,
  bids: null,
  ownedPhunks: null,
  activeMarketRouteData: null,
  txHistory: null,

  activeTraitFilters: {},

  marketType: 'all',
  activeSort: 'id',
  // activeFilters: {},
  activeEventType: 'All',

  modalState: { type: null, active: false },
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
  // Set the events
  on(AppStateActions.setEvents, (state, { events }) => {
    const setEvents = {
      ...state,
      events,
    };
    // console.log('setEvents', setEvents);
    return setEvents
  }),
  // Set trait filters
  on(AppStateActions.setActiveTraitFilters, (state, { activeTraitFilters }) => {
    const setActiveTraitFilters = {
      ...state,
      activeTraitFilters,
    };
    // console.log('setActiveTraitFilters', setActiveTraitFilters);
    return setActiveTraitFilters
  }),
  // Add/remove trait filters
  on(AppStateActions.addRemoveTraitFilter, (state, { traitFilter }) => {
    let activeTraitFilters = { ...state.activeTraitFilters, };

    if (!traitFilter.value) delete activeTraitFilters[traitFilter.key];
    else activeTraitFilters[traitFilter.key] = traitFilter.value;

    const addRemoveTraitFilter = {
      ...state,
      activeTraitFilters,
    };
    // console.log('addRemoveTraitFilter', addRemoveTraitFilter);
    return addRemoveTraitFilter
  }),
  // Clear trait filters
  on(AppStateActions.clearActiveTraitFilters, (state) => {
    const clearTraitFilters = {
      ...state,
      activeTraitFilters: {},
    };
    // console.log('clearTraitFilters', clearTraitFilters);
    return clearTraitFilters
  }),
  on(AppStateActions.setEventType, (state, { eventType }) => {
    const setActiveFilters = {
      ...state,
      activeFilters: eventType,
    };
    // console.log('setActiveFilters', setActiveFilters);
    return setActiveFilters
  }),
  // Set the all phunks
  on(AppStateActions.setAllPhunks, (state, { allPhunks }) => {
    const setAllPhunks = {
      ...state,
      allPhunks,
    };
    // console.log('setAllPhunks', setAllPhunks);
    return setAllPhunks
  }),
  // Set the single phunk
  on(AppStateActions.setSinglePhunk, (state, { phunk }) => {
    const setSinglePhunk = {
      ...state,
      singlePhunk: phunk,
    };
    // console.log('setSinglePhunk', setSinglePhunk);
    return setSinglePhunk
  }),
  on(AppStateActions.setTxHistory, (state, { txHistory }) => {
    const setTxHistory = {
      ...state,
      txHistory,
    };
    // console.log('setTxHistory', setTxHistory);
    return setTxHistory
  }),
  on(AppStateActions.clearTxHistory, (state) => {
    const clearTxHistory = {
      ...state,
      txHistory: null,
    };
    // console.log('clearTxHistory', clearTxHistory);
    return clearTxHistory
  }),
  // Clear the single phunk
  on(AppStateActions.clearSinglePhunk, (state) => {
    const clearSinglePhunk = {
      ...state,
      singlePhunk: null,
    };
    // console.log('clearSinglePhunk', clearSinglePhunk);
    return clearSinglePhunk
  }),
  // Set the market data
  on(AppStateActions.setMarketData, (state, { marketData }) => {
    const setMarketData = {
      ...state,
      marketData,
    };
    // console.log('setMarketData', setMarketData);
    return setMarketData
  }),
  // Set the listings
  on(AppStateActions.setListings, (state, { listings }) => {
    const setListings = {
      ...state,
      listings,
    };
    // console.log('setListings', setListings);
    return setListings
  }),
  // Set the bids
  on(AppStateActions.setBids, (state, { bids }) => {
    const setBids = {
      ...state,
      bids,
    };
    // console.log('setBids', setBids);
    return setBids
  }),
  // Set the owned phunks
  on(AppStateActions.setOwnedPhunks, (state, { ownedPhunks }) => {
    const setOwnedPhunks = {
      ...state,
      ownedPhunks,
    };
    // console.log('setOwnedPhunks', setOwnedPhunks);
    return setOwnedPhunks
  }),
  // Set the active market route data
  on(AppStateActions.setActiveMarketRouteData, (state, { activeMarketRouteData }) => {
    const setActiveMarketRouteData = {
      ...state,
      activeMarketRouteData,
    };
    // console.log('setActiveMarketRouteData', setActiveMarketRouteData);
    return setActiveMarketRouteData
  }),
  // Clear the active market route data
  on(AppStateActions.clearActiveMarketRouteData, (state) => {
    const clearActiveMarketRouteData = {
      ...state,
      activeMarketRouteData: null,
    };
    // console.log('clearActiveMarketRouteData', clearActiveMarketRouteData);
    return clearActiveMarketRouteData
  }),
  // Set the market type
  on(AppStateActions.setMarketType, (state, { marketType }) => {
    const setMarketType = {
      ...state,
      marketType
    };
    // console.log('setMarketType', setMarketType);
    return setMarketType
  }),
  // Set the active sort
  on(AppStateActions.setActiveSort, (state, { activeSort }) => {
    const setActiveSort = {
      ...state,
      activeSort
    };
    // console.log('setActiveSort', setActiveSort);
    return setActiveSort
  }),
);
