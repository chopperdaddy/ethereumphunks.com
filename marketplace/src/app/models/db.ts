import { Attribute } from './attributes';
import { Collection } from './data.state';
import { EventType } from './global-state';

export interface Account {
  id: string;
  phunks?: Phunk[];
}

export interface Phunk {
  slug: string
  hashId: string
  tokenId: number
  createdAt: string
  owner: string
  prevOwner: string | null
  sha: string

  imageUri?: string | null
  creator?: string | null

  isEscrowed?: boolean;
  isBridged?: boolean;
  isAuctioned?: boolean;

  attributes?: Attribute[]
  listing?: Listing | null
  bid?: Bid | null
  event?: Event | null

  auction?: Auction | null

  collection?: Partial<Collection>;

  isSupported?: boolean
  consensus?: boolean

  nft?: {
    owner: string
    tokenId: number
  }

  loading: boolean
}

export interface Bid {
  createdAt: string
  fromAddress: string
  hashId: string
  value: string
  txHash?: string
}
export interface Event {
  blockHash: string
  blockNumber: number | null
  blockTimestamp: string | null
  from: string
  hashId: string
  sha: string
  id: number
  to: string
  txHash: string
  txId: string
  txIndex: string | null
  value: string | null
  type: EventType | null

  slug?: string
  tokenId?: number | null
}
export interface Listing {
  createdAt: string
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
  createdAt: string
}

export interface Auction {
  auctionId: number
  hashId: string
  prevOwner: string | null
  amount: string
  startTime: string | null
  endTime: string | null
  bidder: string | null
  settled: boolean,
  duration: number,
  minBidIncrementPercentage: number,
  timeBuffer: number,

  createdAt?: string
}

export interface AuctionBid {
  id: number
  createdAt: string
  auctionId: number
  fromAddress: string
  amount: string
  extended: boolean
  txHash: string
}
