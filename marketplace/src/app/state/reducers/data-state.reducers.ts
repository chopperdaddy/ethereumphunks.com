import { DataState } from '@/models/data.state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from '../actions/data-state.actions';
import { Phunk } from '@/models/db';

export const initialState: DataState = {
  usd: null,
  events: null,
  allPhunks: null,
  singlePhunk: null,
  marketData: null,
  listings: null,
  bids: null,
  ownedPhunks: null,
  userOpenBids: null,
  activeMarketRouteData: null,
  txHistory: null,
  leaderboard: null,
  collections: null,
  activeCollection: null,
}

export const dataStateReducer: ActionReducer<DataState, Action> = createReducer(
  initialState,
  on(actions.resetDataState, () => initialState),
  // Set the USD price
  on(actions.setUsd, (state, { usd }) => {
    const setUsd = {
      ...state,
      usd,
    };
    // console.log('setUsd', setUsd);
    return setUsd
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
      listings: marketData.filter((item: Phunk) => item.listing && item.listing.minValue !== '0'),
      bids: marketData.filter((item: Phunk) => item.bid && item.bid.value !== '0'),
    };
    // console.log('setMarketData', setMarketData);
    return setMarketData
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
  on(actions.setUserOpenBids, (state, { userOpenBids }) => {
    const setUserOpenBids = {
      ...state,
      userOpenBids
    };
    // console.log('setUserOpenBids', setUserOpenBids);
    return setUserOpenBids
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
  // Set the leaderboard
  on(actions.setLeaderboard, (state, { leaderboard }) => {
    const setLeaderboard = {
      ...state,
      leaderboard,
    };
    // console.log('setLeaderboard', setLeaderboard);
    return setLeaderboard
  }),
  on(actions.setCollections, (state, { collections }) => {
    const setCollections = {
      ...state,
      collections,
    };
    // console.log('setCollections', setCollections);
    return setCollections
  }),
  on(actions.setActiveCollection, (state, { activeCollection }) => {
    const setActiveCollection = {
      ...state,
      activeCollection,
    };
    // console.log('setActiveCollection', setActiveCollection);
    return setActiveCollection
  }),
);
