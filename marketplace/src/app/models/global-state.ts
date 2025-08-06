import { LogItem } from '@/services/socket.service';
import { DataState } from './data.state';
import { MarketState } from './market.state';
import { AdminAuthState } from './admin-auth.state';

import { Theme } from './theme';
import { NormalizedConversation, NormalizedConversationWithMessages } from './chat';

export interface GlobalState {
  appState: AppState;
  dataState: DataState;
  marketState: MarketState;
  notificationState: NotificationState;
  chatState: ChatState;
  modalState: ModalState;
  indexerLogsState: IndexerLogsState;
  adminAuthState: AdminAuthState;
}

export interface IndexerLogsState {
  logsActive: boolean;
  logs: LogItem[];
}

export interface ModalState {
  activeModals: {
    [key: string]: {
      isOpen: boolean;
      config?: {
        width?: number;
        height?: number;
        position?: 'center' | 'right' | 'left';
      } | null;
    }
  };
}

export interface AppState {
  walletAddress: string | undefined;
  connected: boolean;
  hasWithdrawal: number;
  isBanned: boolean;
  userPoints: number;
  activeMultiplier: number;
  theme: Theme;

  isMobile: boolean;
  isBrowserActive: boolean;
  menuActive: boolean;
  activeMenuNav: 'main' | 'leaderboard' | 'curated';
  slideoutActive: boolean;

  eventTypeFilter: EventType;
  eventPage: number;

  scrollPositions: { [navigationId: number]: number };

  currentBlock: number;
  indexerBlock: number;
  blocksBehind: number;

  cooldowns: Cooldowns;

  searchHistory: HistoryItem[];
  searchHistoryActive: boolean;
  isSearchResult: boolean;

  collectionsMenuActive: boolean;

  config: GlobalConfig;

  linkedAccounts: LinkedAccount[];

  advancedMode: boolean;

  logsActive: boolean;
  logs: LogItem[];
}

export interface LinkedAccount {
  address: string;
}

export interface GlobalConfig {
  network: number | null;
  maintenance: boolean;
  auctions: boolean;
  chat: boolean;
  comments: boolean;
  defaultCollection: string | null;
};

export interface ChatState {
  active: boolean;
  activeConversationId: string | null | undefined;

  connected: boolean;
  activeInboxId: string | undefined;

  hasAccount: boolean;

  conversations: NormalizedConversation[] | null;
  activeConversation: NormalizedConversationWithMessages | null;
}

export interface NotificationState {
  notifications: Notification[];
  notifHoverState: { [notificationId: string]: boolean };
}

export interface HistoryItem { type: string; value: string };

export interface Cooldowns {
  [hashId: string]: number;
}

export interface Notification {
  id: string;
  timestamp: number;

  type: 'wallet' | 'pending' | 'complete' | 'error' | 'event' | 'chat';
  function: TxFunction;

  sha?: string;
  hashId?: string;
  chatAddress?: string;
  slug?: string;
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
  | 'purchased'
  | 'chatMessage'
  | 'bridgeOut'
  | 'bridgeIn'
  | 'mint'
  | 'tic'
  | 'ticDelete'
  | 'createBid'
  | 'settleAuction';

export interface TraitFilter {
  [key: string]: string | null;
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
  | 'PhunkNoLongerForSale'
  | 'bridgeOut'
  | 'bridgeIn'
  | 'AuctionCreated'
  | 'AuctionBid'
  | 'AuctionExtended'
  | 'AuctionSettled';
