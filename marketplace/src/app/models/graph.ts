export interface Account {
  id: string;
  phunks?: Phunk[];
}

export interface Phunk {
  id: string;
  hashId?: string;
  owner?: string;
  prevOwner?: string | null;
  attributes: Attribute[];
  isEscrowed?: boolean;
  bid?: Bid | null;
  listing?: Listing | null;
}

export interface Attribute {
  k: string;
  v: string;
}

export interface Listing {
  hashId: string;
  createdAt: Date;
  toAddress: string;
  listed: boolean;
  minValue: string;
  listedBy: string;
  txHash?: string;
  [key: string]: any;
}

export interface Bid {
  hashId: string;
  createdAt: Date;
  fromAddress: string;
  value: string;
  txHash?: string;
  [key: string]: any;
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
