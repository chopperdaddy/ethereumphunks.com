import { AppState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import { Theme } from '@/models/theme';

import * as actions from '../actions/app-state.actions';

export const initialState: AppState = {
  connected: false,
  walletAddress: '',
  hasWithdrawal: 0,
  userPoints: 0,
  activeMultiplier: 1,
  theme: localStorage.getItem('EtherPhunks_theme') as Theme || 'initial',

  isMobile: false,
  menuActive: false,
  activeMenuNav: 'main',
  slideoutActive: false,

  selectedPhunks: null,
  activeTraitFilters: {},

  scrollPositions: {},

  marketType: 'all',
  activeSort: { label: 'Price Low', value: 'price-low' },

  eventTypeFilter: 'All',

  blockNumber: -1,
  transactions: [],
  cooldowns: JSON.parse(localStorage.getItem('EtherPhunks_cooldowns') || '[]'),

  notifHoverState: {},
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
  on(actions.setUserPoints, (state, { userPoints }) => {
    const setUserPoints = {
      ...state,
      userPoints,
    };
    // console.log('setUserPoints', setUserPoints);
    return setUserPoints
  }),
  on(actions.setActiveMultiplier, (state, { activeMultiplier }) => {
    const setActiveMultiplier = {
      ...state,
      activeMultiplier,
    };
    // console.log('setActiveMultiplier', setActiveMultiplier);
    return setActiveMultiplier
  }),
  on(actions.setEventTypeFilter, (state, { eventTypeFilter }) => {
    const setActiveFilters = {
      ...state,
      eventTypeFilter,
    };
    // console.log('setActiveFilters', setActiveFilters);
    return setActiveFilters
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
  on(actions.setSelectedPhunks, (state, { selectedPhunks }) => {
    const setSelectedPhunks = {
      ...state,
      selectedPhunks,
    };
    // console.log('setSelectedPhunks', setSelectedPhunks);
    return setSelectedPhunks
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
      activeSort,
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
  on(actions.setActiveMenuNav, (state, { activeMenuNav }) => {
    const setActiveMenuNav = {
      ...state,
      activeMenuNav
    };
    // console.log('setActiveMenuNav', setActiveMenuNav);
    return setActiveMenuNav
  }),
  on(actions.setSlideoutActive, (state, { slideoutActive }) => {
    const setSlideoutActive = {
      ...state,
      slideoutActive
    };
    // console.log('setSlideoutActive', setSlideoutActive);
    return setSlideoutActive
  }),
  on(actions.setTheme, (state, { theme }) => {
    const setTheme = {
      ...state,
      theme
    };
    // console.log('setTheme', setTheme);
    return setTheme
  }),
  on(actions.removeTransaction, (state, { txId }) => {
    const removeTransaction = {
      ...state,
      transactions: state.transactions.map(tx => tx.id === txId ? { ...tx, dismissed: true } : tx)
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
  on(actions.setTransactions, (state, { transactions }) => {
    const setTransactions = {
      ...state,
      transactions
    };
    // console.log('setTransactions', setTransactions);
    return setTransactions
  }),
  on(actions.setIsMobile, (state, { isMobile }) => {
    const setIsMobile = {
      ...state,
      isMobile
    };
    // console.log('setIsMobile', setIsMobile);
    return setIsMobile
  }),
  on(actions.addCooldown, (state, { cooldown }) => {
    const setCooldowns = {
      ...state,
      cooldowns: [cooldown, ...state.cooldowns]
    };
    // console.log('setCooldowns', setCooldowns);
    return setCooldowns
  }),
  on(actions.removeCooldown, (state, { phunkId }) => {
    const setCooldowns = {
      ...state,
      cooldowns: state.cooldowns.filter(cooldown => cooldown.phunkId !== phunkId)
    };
    // console.log('setCooldowns', setCooldowns);
    return setCooldowns
  }),
  on(actions.newBlock, (state, { blockNumber }) => {
    const setBlockNumber = {
      ...state,
      blockNumber
    };
    // console.log('setBlockNumber', setBlockNumber);
    return setBlockNumber
  }),
  on(actions.setNotifHoverState, (state, { notifHoverState }) => {
    const setNotifHoverState = {
      ...state,
      notifHoverState
    };
    // console.log('setNotifHoverState', setNotifHoverState);
    return setNotifHoverState
  }),
);
