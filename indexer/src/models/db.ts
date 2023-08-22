import { PostgrestError } from '@supabase/supabase-js';

export interface PhunkResponse {
  data: Phunk[];
  error: PostgrestError | null;
}

export interface EventResponse {
  data: Event[];
  error: PostgrestError | null;
}

export interface ShaResponse {
  data: Sha[];
  error: PostgrestError | null;
}

export interface UserResponse {
  data: User[];
  error: PostgrestError | null;
}

export interface Phunk {
  id: number;
  createdAt: string | null;
  creator: string | null;
  owner: string | null;
  prevOwner: string | null;
  hashId: string;
  sha: string;
  phunkId: number | null;
  data: string | null;
  ethscriptionNumber: number | null;
}

export interface Event {
  id: number;
  type: EventType;
  hashId: string | null;
  from: string | null;
  to: string | null;
  blockHash: string | null;
  txIndex: string | null;
  txHash: string;
  phunkId: number | null;
  blockNumber: number | null;
  blockTimestamp: string | null;
}

export interface Sha {
  id: number;
  sha: string | null;
  phunkId: string | null;
}

export interface User {
  id: string;
  createdAt: string | null;
  address: string | null;
}

export type EventType = 'transfer' | 'sale' | 'created' | 'burned';
