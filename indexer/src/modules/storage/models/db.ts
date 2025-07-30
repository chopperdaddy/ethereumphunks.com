import { PostgrestError } from '@supabase/supabase-js';

export interface EthscriptionResponse {
  data: Ethscription[];
  error: PostgrestError | null;
}

export interface CollectionResponse {
  data: Collection[];
  error: PostgrestError | null;
}

export interface EventResponse {
  data: Event[];
  error: PostgrestError | null;
}

export interface CommentResponse {
  data: DBComment[];
  error: PostgrestError | null;
}

export interface AttributesResponse {
  data: AttributeItem[];
  error: PostgrestError | null;
}

export interface UserResponse {
  data: User[];
  error: PostgrestError | null;
}

export interface ListingResponse {
  data: Listing[];
  error: PostgrestError | null;
}

export interface BidResponse {
  data: Bid[];
  error: PostgrestError | null;
}

export interface AuctionResponse {
  data: Auction[];
  error: PostgrestError | null;
}

export interface AuctionBidResponse {
  data: AuctionBid[];
  error: PostgrestError | null;
}

export interface Listing {
  hashId: string
  createdAt: Date
  listed: boolean
  toAddress: string | null
  listedBy: string
  txHash: string
  minValue: number
}

export interface Bid {
  hashId: string
  txHash: string
  createdAt: Date;
  value: string;
  fromAddress: string;
}

export interface Auction {
  auctionId: bigint;
  createdAt: Date;
  hashId: string;
  prevOwner: string | null;
  amount: string;
  startTime: Date | null;
  endTime: Date | null;
  bidder: string | null;
  settled: boolean;
}

export interface AuctionBid {
  id: bigint;
  createdAt: Date;
  auctionId: bigint;
  fromAddress: string;
  amount: string;
  extended: boolean;
}

export interface Ethscription {
  hashId: string;
  createdAt: Date | null;
  creator: string | null;
  owner: string | null;
  sha: string;
  tokenId: number | null;
  prevOwner: string;
  slug: string | null;
  locked: boolean;
}

export interface Collection {
  slug: string;
  createdAt: Date;
  posterHashId?: string;
  name: string;
  description?: string;
  image?: string;
  singleName?: string;
  active: boolean;
  supply: number;
  id: number;
  website?: string;
  twitter?: string;
  discord?: string;
  isMinting: boolean;
  hasBackgrounds: boolean;
  notifications: boolean;
  mintEnabled: boolean;
  defaultBackground?: string;
  standalone: boolean;
}

export interface Event {
  txId: string;
  type: EventType;
  hashId: string | null;
  from: string | null;
  to: string | null;
  blockHash: string | null;
  txIndex: number | null;
  txHash: string;
  blockNumber: number | null;
  blockTimestamp: Date | null;
  value: string | null;
  l2?: boolean;
}

export interface DBComment {
  id: string;
  topic: string;
  topicType: string;
  content: string;
  version: string;
  createdAt: Date;
  from: string;
  deleted?: boolean;
  encoding?: string;
  type?: string;
}

export interface AttributeItem {
  sha: string;
  values: {k: string, v: string | string[]}[];
  slug: string;
  tokenId: number | null;
}

export interface User {
  createdAt: Date;
  address: string;
}

export interface EthscriptionWithCollectionAndAttributes {
  ethscription: Ethscription;
  collection: Collection;
  attributes: AttributeItem;
}

export type EventType = 'transfer' | 'sale' | 'created' | 'burned' | 'PhunkOffered' | 'PhunkBidEntered' | 'PhunkBought' | 'PhunkBidWithdrawn' | 'PhunkDeposited' | 'PhunkWithdrawn' | 'PhunkNoLongerForSale' | 'AuctionCreated' | 'AuctionBid' | 'AuctionExtended' | 'AuctionSettled';
