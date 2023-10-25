import { Phunk } from './graph';
import { MarketTypes, Sorts } from './pipes';
import { ModalState } from './transaction';

export interface GlobalState {
  appState: AppState;
}

export interface AppState {
  walletAddress: string;
  connected: boolean;
  hasWithdrawal: boolean;

  events: any[] | null;
  allPhunks: Phunk[] | null;
  singlePhunk: Phunk | null;
  marketData: Phunk[] | null;
  listings: Phunk[] | null;
  bids: Phunk[] | null;
  ownedPhunks: Phunk[] | null;
  activeMarketRouteData: Phunk[] | null;
  txHistory: any[] | null;
  selectedPhunks: Phunk[] | null;

  activeTraitFilters: TraitFilter;

  marketType: MarketTypes;
  activeSort: Sorts;
  // activeFilters: any;
  activeEventType: EventType;
}

export interface TraitFilter { [key: string]: string };

export interface TxFilterItem { label: string, value: EventType };

export type EventType = 'All' | 'created' | 'transfer' | 'PhunkOffered' | 'PhunkBidEntered' | 'PhunkBidWithdrawn' | 'PhunkBought' | 'PhunkOfferWithdrawn';
