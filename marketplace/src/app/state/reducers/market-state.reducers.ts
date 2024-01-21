import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import { MarketState } from '@/models/market.state';
import { Phunk } from '@/models/db';

import * as actions from '../actions/market-state.actions';

export const initialState: MarketState = {
  marketType: null,
  marketSlug: 'ethereum-phunks',

  marketData: [],
  owned: [],
  listings: [],
  bids: [],
  all: [],
  activeMarketRouteData: {
    data: [],
    total: 0
  },

  selectedPhunks: [],

  activeSort: { label: 'Price Low', value: 'price-low' },
  activeTraitFilters: {},

  pagination: {
    fromIndex: 0,
    toIndex: 0,
  },
};

export const marketStateReducer: ActionReducer<MarketState, Action> = createReducer(
  initialState,
  on(actions.resetMarketState, () => initialState),
  // Set the market type
  on(actions.setMarketType, (state, { marketType }) => {
    const setMarketType = {
      ...state,
      marketType
    };
    return setMarketType
  }),
  on(actions.setMarketSlug, (state, { marketSlug }) => {
    const setMarketSlug = {
      ...state,
      marketSlug
    };
    return setMarketSlug;
  }),
  on(actions.setOwned, (state, { owned }) => {
    const setOwned = {
      ...state,
      owned,
    };
    return setOwned
  }),
  on(actions.setMarketData, (state, { marketData }) => {
    const setMarketData = {
      ...state,
      marketData,
      listings: marketData.filter((item: Phunk) => item.listing && item.listing.minValue !== '0'),
      bids: marketData.filter((item: Phunk) => item.bid && item.bid.value !== '0'),
    };
    return setMarketData
  }),
  on(actions.setAll, (state, { all }) => {
    const setAllPhunks = {
      ...state,
      all,
    };
    return setAllPhunks
  }),
  on(actions.setActiveMarketRouteData, (state, { activeMarketRouteData }) => {
    const setActiveMarketRouteData = {
      ...state,
      activeMarketRouteData,
    };
    return setActiveMarketRouteData
  }),
  on(actions.clearActiveMarketRouteData, (state) => {
    const clearActiveMarketRouteData = {
      ...state,
      activeMarketRouteData: initialState.activeMarketRouteData,
    };
    return clearActiveMarketRouteData
  }),
  on(actions.setActiveTraitFilters, (state, { traitFilters }) => {
    const setActiveTraitFilters = {
      ...state,
      activeTraitFilters: traitFilters,
    };
    return setActiveTraitFilters
  }),
  on(actions.setSelectedPhunks, (state, { selectedPhunks }) => {
    const setSelectedPhunks = {
      ...state,
      selectedPhunks,
    };
    return setSelectedPhunks
  }),
  on(actions.setActiveSort, (state, { activeSort }) => {
    const setActiveSort = {
      ...state,
      activeSort,
    };
    return setActiveSort
  }),
  // Pagination
  on(actions.setPagination, (state, { pagination }) => {
    const setPagination = {
      ...state,
      pagination,
    };
    return setPagination
  }),
);
