import { Phunk } from './db';

export interface DataState {


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
}
