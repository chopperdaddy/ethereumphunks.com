export interface Account {
  id: string;
  phunks?: Phunk[];
}

export interface Phunk {
  id: string;
  hashId?: string;
  owner?: Account;
  prevOwner?: Account;
  wrapped?: boolean;
  isEscrowed?: boolean;
  bid?: Bid | null;
  listing?: Listing | null;
  attributes: Attribute[];
}

export interface Attribute {
  k: string;
  v: string;
}

export interface Listing {
  id: string;
  phunk?: Phunk;
  value: string;
  usd?: string;
  fromAccount?: Account;
  toAccount?: Account;
  blockTimestamp?: string;
  source?: Source;
}

export interface Bid {
  id: string;
  phunk?: Phunk;
  value: string;
  usd?: string;
  fromAccount?: Account;
  blockTimestamp?: string;
  source?: Source;
}

export interface Event {

  from: string | null;
  to: string | null;
  txHash: string;
  createdAt: string;
  phunkId: number;

  id: string;
  type: EventType;
  tokenId: string;
  fromAccount: Account | null;
  toAccount: Account | null;
  value: string | null;
  usd: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
}

export interface State {
  id: string;
  timestamp: string;
  usd: string;
  topBid: Event;
  topSale: Event;
  listings: string;
  delistings: string;
  bids: string;
  sales: string;
  owners: string;
  volume: string;
  floor: string;
}

export interface Source {
  id: string;
  domain: string;
  name: string;
  icon: string;
  url: string;
}

export type EventType = 'All' | 'Created' | 'transfer' | 'Offered' | 'BidEntered' | 'BidWithdrawn' | 'sale' | 'OfferWithdrawn';
