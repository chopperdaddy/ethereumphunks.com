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

  scrollPositions: {},

  eventTypeFilter: 'All',

  currentBlock: 0,
  indexerBlock: 0,
  blocksBehind: 0,

  cooldowns: JSON.parse(localStorage.getItem('EtherPhunks_cooldowns') || '{}'),

  searchHistory: JSON.parse(localStorage.getItem('EtherPhunks_searchHistory') || '[]'),
  searchHistoryActive: false,
  isSearchResult: false,

  modalActive: false,
};

export const appStateReducer: ActionReducer<AppState, Action> = createReducer(
  initialState,
  on(actions.resetAppState, () => initialState),
  on(actions.setConnected, (state, { connected }) => {
    const setConnected = {
      ...state,
      connected,
    };
    return setConnected
  }),
  on(actions.setWalletAddress, (state, { walletAddress }) => {
    const setWalletAddress = {
      ...state,
      walletAddress: walletAddress?.toLowerCase(),
    };
    return setWalletAddress
  }),
  // Set the withdrawal status
  on(actions.setHasWithdrawal, (state, { hasWithdrawal }) => {
    const setHasWithdrawal = {
      ...state,
      hasWithdrawal,
    };
    return setHasWithdrawal
  }),
  on(actions.setUserPoints, (state, { userPoints }) => {
    const setUserPoints = {
      ...state,
      userPoints,
    };
    return setUserPoints
  }),
  on(actions.setActiveMultiplier, (state, { activeMultiplier }) => {
    const setActiveMultiplier = {
      ...state,
      activeMultiplier,
    };
    return setActiveMultiplier
  }),
  on(actions.setEventTypeFilter, (state, { eventTypeFilter }) => {
    const setActiveFilters = {
      ...state,
      eventTypeFilter,
    };
    return setActiveFilters
  }),
  on(actions.setMenuActive, (state, { menuActive }) => {
    const setMenuActive = {
      ...state,
      menuActive
    };
    return setMenuActive
  }),
  on(actions.setActiveMenuNav, (state, { activeMenuNav }) => {
    const setActiveMenuNav = {
      ...state,
      activeMenuNav
    };
    return setActiveMenuNav
  }),
  on(actions.setSlideoutActive, (state, { slideoutActive }) => {
    const setSlideoutActive = {
      ...state,
      slideoutActive
    };
    return setSlideoutActive
  }),
  on(actions.setTheme, (state, { theme }) => {
    const setTheme = {
      ...state,
      theme
    };
    return setTheme
  }),
  on(actions.addCooldown, (state, { cooldown }) => {
    // console.log('addCooldown', cooldown);
    const setCooldowns = {
      ...state,
      cooldowns: {
        ...state.cooldowns,
        ...cooldown
      }
    };
    return setCooldowns
  }),
  on(actions.setCooldowns, (state, { cooldowns }) => {
    const removeCooldown = {
      ...state,
      cooldowns: {
        ...cooldowns
      }
    };
    localStorage.setItem('EtherPhunks_cooldowns', JSON.stringify(cooldowns));
    return removeCooldown
  }),
  on(actions.setCurrentBlock, (state, { currentBlock }) => {
    const setCurrentBlock = {
      ...state,
      currentBlock,
      blocksBehind: (currentBlock - state.indexerBlock)
    };
    return setCurrentBlock
  }),
  on(actions.setIndexerBlock, (state, { indexerBlock }) => {
    const setIndexerBlock = {
      ...state,
      indexerBlock,
      blocksBehind: (state.currentBlock - indexerBlock)
    };
    return setIndexerBlock;
  }),
  on(actions.setSearchHistory, (state, { searchHistory }) => {
    const setSearchHistory = {
      ...state,
      searchHistory
    };
    return setSearchHistory
  }),
  on(actions.addSearchHistory, (state, { item }) => {
    let searchHistoryCopy = [ ...state.searchHistory ];
    const index = searchHistoryCopy.findIndex(itm => itm.value === item.value);
    if (index > -1) searchHistoryCopy.splice(index, 1);
    searchHistoryCopy.unshift(item);

    const addSearchHistory = {
      ...state,
      searchHistory: searchHistoryCopy
    };
    return addSearchHistory
  }),
  on(actions.removeSearchHistory, (state, { index }) => {
    const removeSearchHistory = {
      ...state,
      searchHistory: state.searchHistory.filter((_, i) => i !== index)
    };
    return removeSearchHistory;
  }),
  on(actions.clearSearchHistory, (state) => {
    const resetSearchHistory = {
      ...state,
      searchHistory: []
    };
    return resetSearchHistory
  }),
  on(actions.setSearchHistoryActive, (state, { searchHistoryActive }) => {
    const setSearchHistoryActive = {
      ...state,
      searchHistoryActive
    };
    return setSearchHistoryActive
  }),
  on(actions.setIsSearchResult, (state, { isSearchResult }) => {
    const setIsSearchResult = {
      ...state,
      isSearchResult
    };
    return setIsSearchResult
  }),
  on(actions.setModalActive, (state, { modalActive }) => {
    const setModalActive = {
      ...state,
      modalActive
    };
    return setModalActive
  }),
);
