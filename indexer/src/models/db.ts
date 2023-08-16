import { PostgrestError } from '@supabase/supabase-js';

export interface EthPhunkResponse {
  data: EthPhunk[];
  error: PostgrestError | null;
}

export interface EthPhunkTransferResponse {
  data: EthPhunkTransfer[];
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

export interface EthPhunk {
  id: number
  createdAt: string | null
  creator: string | null
  owner: string | null
  hashId: string
  blockHash: string | null
  txIndex: number | null
  sha: string
  phunkId: number | null
  data: string | null
  ethscriptionNumber: number | null
}

export interface EthPhunkTransfer {
  id: number
  createdAt: string | null
  hashId: string | null
  from: string | null
  to: string | null
  blockHash: string | null
  txIndex: string | null
  txHash: string
  phunkId: number | null
  blockNumber: number | null
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
