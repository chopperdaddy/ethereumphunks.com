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
  activeMarketRouteData: [],

  selectedPhunks: [],

  activeSort: { label: 'Price Low', value: 'price-low' },
  activeTraitFilters: {},

  pagination: {
    currentPage: 1,
    pageSize: 250,
    hasMore: false,
    isLoading: false,
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
      activeMarketRouteData: [],
    };
    return clearActiveMarketRouteData
  }),
  on(actions.setActiveTraitFilters, (state, { activeTraitFilters }) => {
    const setActiveTraitFilters = {
      ...state,
      activeTraitFilters,
    };
    return setActiveTraitFilters
  }),
  on(actions.addRemoveTraitFilter, (state, { traitFilter }) => {
    let activeTraitFilters = { ...state.activeTraitFilters, };

    if (!traitFilter.value) delete activeTraitFilters[traitFilter.key];
    else activeTraitFilters[traitFilter.key] = traitFilter.value;

    const addRemoveTraitFilter = {
      ...state,
      activeTraitFilters,
    };
    return addRemoveTraitFilter
  }),
  on(actions.clearActiveTraitFilters, (state) => {
    const clearTraitFilters = {
      ...state,
      activeTraitFilters: {},
    };
    return clearTraitFilters
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
  on(actions.resetPagination, (state) => {
    const resetPagination = {
      ...state,
      pagination: initialState.pagination,
    };
    return resetPagination
  }),
  on(actions.setCurrentPage, (state, { currentPage }) => {
    const setCurrentPage = {
      ...state,
      pagination: {
        ...state.pagination,
        currentPage,
      }
    };
    return setCurrentPage
  }),
  on(actions.setPageSize, (state, { pageSize }) => {
    const setPageSize = {
      ...state,
      pagination: {
        ...state.pagination,
        pageSize,
      }
    };
    return setPageSize
  }),
  on(actions.setHasMore, (state, { hasMore }) => {
    const setHasMore = {
      ...state,
      pagination: {
        ...state.pagination,
        hasMore,
      }
    };
    return setHasMore
  }),
  on(actions.setIsLoading, (state, { isLoading }) => {
    const setIsLoading = {
      ...state,
      pagination: {
        ...state.pagination,
        isLoading,
      }
    };
    return setIsLoading
  }),
);
