import { DataState } from './data.state';
import { MarketState, MarketType } from './market.state';

import { Phunk } from './db';
import { Sort, Sorts } from './pipes';
import { Theme } from './theme';

export interface GlobalState {
  appState: AppState;
  dataState: DataState;
  marketState: MarketState;
}

export interface AppState {
  walletAddress: string;
  connected: boolean;
  hasWithdrawal: number;
  userPoints: number;
  activeMultiplier: number;
  theme: Theme;

  isMobile: boolean;
  menuActive: boolean;
  activeMenuNav: 'main' | 'leaderboard' | 'curated';
  slideoutActive: boolean;

  eventTypeFilter: EventType;

  scrollPositions: { [navigationId: number]: number };

  currentBlock: number;
  indexerBlock: number;

  notifications: Notification[];
  cooldowns: Cooldowns;

  notifHoverState: { [notificationId: string]: boolean };

  searchHistory: HistoryItem[];
  searchHistoryActive: boolean;
  isSearchResult: boolean;
}

export interface HistoryItem { type: string; value: string };

export interface Cooldowns {
  [hashId: string]: number;
}

export interface Notification {
  id: number;
  slug?: string;

  type: 'wallet' | 'pending' | 'complete' | 'error' | 'event';
  function: TxFunction;

  hashId: string;
  tokenId?: number | null;

  isBatch?: boolean;
  hashIds?: string[];

  isNotification?: boolean;
  dismissed?: boolean;

  hash?: string | null;
  detail?: any;
  value?: number | null;
}

export type TxFunction =
  | 'sendToEscrow'
  | 'phunkNoLongerForSale'
  | 'offerPhunkForSale'
  | 'withdrawBidForPhunk'
  | 'acceptBidForPhunk'
  | 'buyPhunk'
  | 'enterBidForPhunk'
  | 'transferPhunk'
  | 'withdrawPhunk'
  | 'purchased';

export interface TraitFilter {
  [key: string]: string;
}

export interface TxFilterItem {
  label: string;
  value: EventType;
}

export type EventType =
  | 'All'
  | 'created'
  | 'transfer'
  | 'escrow'
  | 'PhunkOffered'
  | 'PhunkBidEntered'
  | 'PhunkBidWithdrawn'
  | 'PhunkBought'
  | 'PhunkOfferWithdrawn';
