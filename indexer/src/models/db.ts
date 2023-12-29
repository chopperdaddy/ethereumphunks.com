import { PostgrestError } from '@supabase/supabase-js';

export interface EthscriptionResponse {
  data: Ethscription[];
  error: PostgrestError | null;
}

export interface EventResponse {
  data: Event[];
  error: PostgrestError | null;
}

export interface ShaResponse {
  data: PhunkSha[];
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

export interface Listing {
  hashId: string
  blockNum: number
  createdAt: string
  isListed: boolean
  onlySellTo: string | null
  seller: string
  transactionHash: string
  value: number
}

export interface Bid {
  hashId: string
  txHash: string
  createdAt: string;
  value: string;
  fromAddress: string;
}

export interface Ethscription {
  hashId: string;
  createdAt: string | null;
  creator: string | null;
  owner: string | null;
  sha: string;
  tokenId: number | null;
  ethscriptionNumber?: number | null;
  prevOwner?: string | null;
  slug?: string | null;
  data?: string | null;
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
}

export interface PhunkSha {
  sha: string | null;
  phunkId: number;
}

export interface CuratedItem {
  name: string;
  attributes: {k: string, v: string}[];
  slug: string;
  tokenId: number | null;
  sha: string;
}

export interface User {
  createdAt: Date;
  address: string;
}

export type EventType = 'transfer' | 'sale' | 'created' | 'burned' | 'PhunkOffered' | 'PhunkBidEntered' | 'PhunkBought' | 'PhunkBidWithdrawn' | 'PhunkDeposited' | 'PhunkWithdrawn' | 'PhunkNoLongerForSale';
