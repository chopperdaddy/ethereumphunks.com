import { DataState } from './data.state';
import { Phunk } from './graph';
import { MarketTypes, Sorts } from './pipes';
import { Theme } from './theme';

export interface GlobalState {
  appState: AppState;
  dataState: DataState;
}

export interface AppState {
  walletAddress: string;
  connected: boolean;
  hasWithdrawal: boolean;
  theme: Theme;

  isMobile: boolean;
  menuActive: boolean;

  selectedPhunks: Phunk[] | null;
  activeTraitFilters: TraitFilter;

  marketType: MarketTypes;
  activeSort: Sorts;
  // activeFilters: any;
  activeEventType: EventType;

  blockNumber: number;
  transactions: Transaction[];
  cooldowns: Cooldown[]
};

export interface Cooldown {
  phunkId: number;
  startBlock: number;
}

export interface Transaction {
  id: number;
  type: 'wallet' | 'pending' | 'complete' | 'error';
  function: TxFunction;
  phunkId: number;
  hash?: string | null;
  detail?: any;
};

export type TxFunction = 'sendToEscrow' | 'phunkNoLongerForSale' | 'offerPhunkForSale' | 'withdrawBidForPhunk' | 'acceptBidForPhunk' | 'buyPhunk' | 'enterBidForPhunk' | 'transferPhunk' | 'withdrawPhunk';

export interface TraitFilter { [key: string]: string };

export interface TxFilterItem { label: string, value: EventType };

export type EventType = 'All' | 'created' | 'transfer' | 'PhunkOffered' | 'PhunkBidEntered' | 'PhunkBidWithdrawn' | 'PhunkBought' | 'PhunkOfferWithdrawn';
