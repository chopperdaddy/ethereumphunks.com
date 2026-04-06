import { Event, Phunk } from './db';

export interface Collection {
  id: number;
  slug: string;
  name: string;
  singleName: string;
  description: string;
  supply: number;
  active: boolean;
  isMinting: boolean;
  mintEnabled: boolean;
  hasBackgrounds: boolean;
  notifications: boolean;
  standalone: boolean;

  // Optional fields
  image?: string;
  createdAt?: string;
  posterHashId?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  defaultBackground?: string;
  mainTrait?: string;
  contractAddress?: string;
  type?: 'nft' | 'inscription';

  // Arrays
  adminAddress?: string[];
  ignoredTraitFilters: string[];
  ignoredTraitFiltersForCounts: string[];

  // Runtime fields
  previews?: Phunk[];
  stats?: {
    sales: number;
    volume: number;
  };
}

export interface DataState {
  usd: number | null;
  events: Event[] | null;
  userOpenBids: Phunk[];

  txHistory: any[] | null;
  leaderboard: any[] | null;
  collections: Collection[];
  activeCollection: Collection | null;
}
