import { Phunk } from './graph';

export interface GlobalState {
  appState: AppState;
}

export interface AppState {
  walletAddress: string;
  connected: boolean;
  hasWithdrawal: boolean;
  singlePhunk: Phunk | null;
  marketData: Phunk[] | null;
  ownedPhunks: Phunk[] | null;
}
