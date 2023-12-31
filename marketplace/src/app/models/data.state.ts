import { Phunk } from './db';

export interface Collection {
  slug: string;
  singleName: string;
  supply: number;
  name?: string;
  description?: string;
  image?: string;
}

export interface DataState {
  usd: number | null;
  events: any[] | null;
  allPhunks: Phunk[] | null;
  singlePhunk: Phunk | null;
  marketData: Phunk[] | null;
  listings: Phunk[] | null;
  bids: Phunk[] | null;
  ownedPhunks: Phunk[] | null;
  userOpenBids: Phunk[] | null;
  activeMarketRouteData: Phunk[] | null;

  txHistory: any[] | null;
  leaderboard: any[] | null;
  collections: any[] | null;
  activeCollection: Collection | null;
}
