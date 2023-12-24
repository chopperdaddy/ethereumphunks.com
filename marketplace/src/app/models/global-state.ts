import { DataState } from './data.state';
import { Phunk } from './db';
import { MarketType, Sort, Sorts } from './pipes';
import { Theme } from './theme';

export interface GlobalState {
  appState: AppState;
  dataState: DataState;
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
  activeMenuNav: 'main' | 'leaderboard';
  slideoutActive: boolean;

  selectedPhunks: Phunk[] | null;
  activeTraitFilters: TraitFilter;
  eventTypeFilter: EventType;

  scrollPositions: { [navigationId: number]: number };

  marketType: MarketType;
  marketSlug: string;

  activeSort: Sort;

  blockNumber: number;
  notifications: Notification[];
  cooldowns: Cooldown[];

  notifHoverState: { [notificationId: string]: boolean };
}

export interface Cooldown {
  hashId: string;
  startBlock: number;
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
