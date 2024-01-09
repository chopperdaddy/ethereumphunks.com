import { EventType } from './global-state';

export interface Account {
  id: string;
  phunks?: Phunk[];
}

export interface Auction {
  amount: string
  auctionId: number
  bidder: string | null
  createdAt: Date
  endTime: number
  hashId: string
  prevOwner: string | null
  settled: boolean
  startTime: number
  bids: Bid[] | null
}

export interface Phunk {
  slug: string
  hashId: string
  tokenId: number
  createdAt: Date
  owner: string
  prevOwner: string | null
  sha: string

  creator?: string | null
  data?: string | null

  isEscrowed?: boolean;
  attributes?: Attribute[]
  listing?: Listing | null
  bid?: Bid | null

  auction?: Auction | null

  singleName?: string | null
  collectionName?: string | null
  supply?: number | null
}

export interface Bid {
  createdAt: Date
  fromAddress: string
  hashId: string
  value: string
  txHash?: string
}
export interface Event {
  blockHash: string
  blockNumber: number | null
  blockTimestamp: Date | null
  from: string
  hashId: string
  id: number
  tokenId?: number | null
  to: string
  txHash: string
  txId: string
  txIndex: string | null
  type: EventType | null
  value: string | null
}
export interface Listing {
  createdAt: Date
  hashId: string
  listed: boolean
  listedBy: string
  minValue: string
  toAddress: string | null
  txHash?: string
}

export interface Sha {
  id: number
  phunkId: string | null
  sha: string | null
}

export interface User {
  address: string
  createdAt: Date
}

export interface Attribute {
  k: string;
  v: string;
}


// import { EventType } from './global-state';

// export interface Account {
//   id: string;
//   phunks?: Phunk[];
// }

// export interface Phunk {
//   id: string;
//   hashId?: string;
//   owner?: string;
//   prevOwner?: string | null;
//   attributes: Attribute[];
//   isEscrowed?: boolean;
//   bid?: Bid | null;
//   listing?: Listing | null;
// }

// export interface Attribute {
//   k: string;
//   v: string;
// }

// export interface Listing {
//   hashId: string;
//   createdAt: Date;
//   toAddress: string;
//   listed: boolean;
//   minValue: string;
//   listedBy: string;
//   txHash?: string;
//   [key: string]: any;
// }

// export interface Bid {
//   hashId: string;
//   createdAt: Date;
//   fromAddress: string;
//   value: string;
//   txHash?: string;
//   [key: string]: any;
// }

// export interface Event {

//   from: string | null;
//   to: string | null;
//   txHash: string;
//   createdAt: string;
//   phunkId: number;

//   id: string;
//   type: EventType;
//   tokenId: string;
//   fromAccount: Account | null;
//   toAccount: Account | null;
//   value: string | null;
//   usd: string;
//   blockNumber: string;
//   blockTimestamp: string;
//   transactionHash: string;
// }

// export interface State {
//   id: string;
//   timestamp: string;
//   usd: string;
//   topBid: Event;
//   topSale: Event;
//   listings: string;
//   delistings: string;
//   bids: string;
//   sales: string;
//   owners: string;
//   volume: string;
//   floor: string;
// }

// export interface Source {
//   id: string;
//   domain: string;
//   name: string;
//   icon: string;
//   url: string;
// }
