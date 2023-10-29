import { AppState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from '../actions/app-state.action';

export const initialState: AppState = {
  connected: false,
  walletAddress: '',
  hasWithdrawal: false,
  theme: 'initial',

  isMobile: false,
  menuActive: false,

  events: null,
  allPhunks: null,
  singlePhunk: null,
  marketData: null,
  listings: null,
  bids: null,
  ownedPhunks: null,
  activeMarketRouteData: null,
  txHistory: null,
  selectedPhunks: null,

  activeTraitFilters: {},

  marketType: 'all',
  activeSort: 'id',

  activeEventType: 'All',

  transactions: [],
};

export const appStateReducer: ActionReducer<AppState, Action> = createReducer(
  initialState,
  on(actions.resetAppState, () => initialState),
  // Set the wallet connected
  on(actions.setConnected, (state, { connected }) => {
    const setConnected = {
      ...state,
      connected,
    };
    // console.log('setConnected', setConnected);
    return setConnected
  }),
  // Set the wallet address
  on(actions.setWalletAddress, (state, { walletAddress }) => {
    const setWalletAddress = {
      ...state,
      walletAddress: walletAddress.toLowerCase(),
    };
    // console.log('setWalletAddress', setWalletAddress);
    return setWalletAddress
  }),
  // Set the withdrawal status
  on(actions.setHasWithdrawal, (state, { hasWithdrawal }) => {
    const setHasWithdrawal = {
      ...state,
      hasWithdrawal,
    };
    // console.log('setHasWithdrawal', setHasWithdrawal);
    return setHasWithdrawal
  }),
  // Set the events
  on(actions.setEvents, (state, { events }) => {
    const setEvents = {
      ...state,
      events,
    };
    // console.log('setEvents', setEvents);
    return setEvents
  }),
  on(actions.setEventType, (state, { eventType }) => {
    const setEventType = {
      ...state,
      activeEventType: eventType,
    };
    // console.log('setEventType', setEventType);
    return setEventType;
  }),
  // Set trait filters
  on(actions.setActiveTraitFilters, (state, { activeTraitFilters }) => {
    const setActiveTraitFilters = {
      ...state,
      activeTraitFilters,
    };
    // console.log('setActiveTraitFilters', setActiveTraitFilters);
    return setActiveTraitFilters
  }),
  // Add/remove trait filters
  on(actions.addRemoveTraitFilter, (state, { traitFilter }) => {
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
  on(actions.clearActiveTraitFilters, (state) => {
    const clearTraitFilters = {
      ...state,
      activeTraitFilters: {},
    };
    // console.log('clearTraitFilters', clearTraitFilters);
    return clearTraitFilters
  }),
  on(actions.setEventType, (state, { eventType }) => {
    const setActiveFilters = {
      ...state,
      activeFilters: eventType,
    };
    // console.log('setActiveFilters', setActiveFilters);
    return setActiveFilters
  }),
  // Set the all phunks
  on(actions.setAllPhunks, (state, { allPhunks }) => {
    const setAllPhunks = {
      ...state,
      allPhunks,
    };
    // console.log('setAllPhunks', setAllPhunks);
    return setAllPhunks
  }),
  // Set the single phunk
  on(actions.setSinglePhunk, (state, { phunk }) => {
    const setSinglePhunk = {
      ...state,
      singlePhunk: phunk,
    };
    // console.log('setSinglePhunk', setSinglePhunk);
    return setSinglePhunk
  }),
  on(actions.setTxHistory, (state, { txHistory }) => {
    const setTxHistory = {
      ...state,
      txHistory,
    };
    // console.log('setTxHistory', setTxHistory);
    return setTxHistory
  }),
  on(actions.clearTxHistory, (state) => {
    const clearTxHistory = {
      ...state,
      txHistory: null,
    };
    // console.log('clearTxHistory', clearTxHistory);
    return clearTxHistory
  }),
  // Clear the single phunk
  on(actions.clearSinglePhunk, (state) => {
    const clearSinglePhunk = {
      ...state,
      singlePhunk: null,
    };
    // console.log('clearSinglePhunk', clearSinglePhunk);
    return clearSinglePhunk
  }),
  // Set the market data
  on(actions.setMarketData, (state, { marketData }) => {
    const setMarketData = {
      ...state,
      marketData,
    };
    // console.log('setMarketData', setMarketData);
    return setMarketData
  }),
  // Set the listings
  on(actions.setListings, (state, { listings }) => {
    const setListings = {
      ...state,
      listings,
    };
    // console.log('setListings', setListings);
    return setListings
  }),
  // Set the bids
  on(actions.setBids, (state, { bids }) => {
    const setBids = {
      ...state,
      bids,
    };
    // console.log('setBids', setBids);
    return setBids
  }),
  // Set the owned phunks
  on(actions.setOwnedPhunks, (state, { ownedPhunks }) => {
    const setOwnedPhunks = {
      ...state,
      ownedPhunks,
    };
    // console.log('setOwnedPhunks', setOwnedPhunks);
    return setOwnedPhunks
  }),
  on(actions.setSelectedPhunks, (state, { selectedPhunks }) => {
    const setSelectedPhunks = {
      ...state,
      selectedPhunks,
    };
    // console.log('setSelectedPhunks', setSelectedPhunks);
    return setSelectedPhunks
  }),
  // Set the active market route data
  on(actions.setActiveMarketRouteData, (state, { activeMarketRouteData }) => {
    const setActiveMarketRouteData = {
      ...state,
      activeMarketRouteData,
    };
    // console.log('setActiveMarketRouteData', setActiveMarketRouteData);
    return setActiveMarketRouteData
  }),
  // Clear the active market route data
  on(actions.clearActiveMarketRouteData, (state) => {
    const clearActiveMarketRouteData = {
      ...state,
      activeMarketRouteData: null,
    };
    // console.log('clearActiveMarketRouteData', clearActiveMarketRouteData);
    return clearActiveMarketRouteData
  }),
  // Set the market type
  on(actions.setMarketType, (state, { marketType }) => {
    const setMarketType = {
      ...state,
      marketType
    };
    // console.log('setMarketType', setMarketType);
    return setMarketType
  }),
  // Set the active sort
  on(actions.setActiveSort, (state, { activeSort }) => {
    const setActiveSort = {
      ...state,
      activeSort
    };
    // console.log('setActiveSort', setActiveSort);
    return setActiveSort
  }),
  on(actions.setMenuActive, (state, { menuActive }) => {
    const setMenuActive = {
      ...state,
      menuActive
    };
    // console.log('setMenuActive', setMenuActive);
    return setMenuActive
  }),
  on(actions.setTheme, (state, { theme }) => {
    const setTheme = {
      ...state,
      theme
    };
    // console.log('setTheme', setTheme);
    return setTheme
  }),
  on(actions.addTransaction, (state, { transaction }) => {
    const addTransaction = {
      ...state,
      transactions: [transaction, ...state.transactions]
    };
    // console.log('addTransaction', addTransaction);
    return addTransaction
  }),
  on(actions.removeTransaction, (state, { txId }) => {
    const removeTransaction = {
      ...state,
      transactions: state.transactions.filter(tx => tx.id !== txId)
    };
    // console.log('removeTransaction', removeTransaction);
    return removeTransaction
  }),
  on(actions.upsertTransaction, (state, { transaction }) => {

    const txns = [...state.transactions];
    const index = txns.findIndex(tx => tx.phunkId === transaction.phunkId);
    if (index > -1) txns.splice(index, 1, transaction);
    else txns.push(transaction);

    const upsertTransaction = {
      ...state,
      transactions: txns
    };
    // console.log('upsertTransaction', upsertTransaction);
    return upsertTransaction
  }),
  on(actions.clearTransactions, (state) => {
    const clearTransactions = {
      ...state,
      transactions: []
    };
    // console.log('clearTransactions', clearTransactions);
    return clearTransactions
  }),
  on(actions.setIsMobile, (state, { isMobile }) => {
    const setIsMobile = {
      ...state,
      isMobile
    };
    // console.log('setIsMobile', setIsMobile);
    return setIsMobile
  }),
);
