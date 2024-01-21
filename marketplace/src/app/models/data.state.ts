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
  singlePhunk: Phunk | null;
  userOpenBids: Phunk[];

  txHistory: any[] | null;
  leaderboard: any[] | null;
  collections: any[] | null;
  activeCollection: Collection | null;
}
