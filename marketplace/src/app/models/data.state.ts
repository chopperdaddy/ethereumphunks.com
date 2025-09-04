import { Event, Phunk } from './db';

export interface Collection {
  id: number;
  slug: string;
  name: string;
  singleName: string;
  description: string;
  supply: number;
  isMinting: boolean;
  mintEnabled: boolean;
  hasBackgrounds: boolean;
  defaultBackground: string;

  image?: string;
  previews?: Phunk[];
  stats?: {
    sales: number;
    volume: number;
  };

  ignoredTraitFilters: string[];
  ignoredTraitFiltersForCounts: string[];
  mainTrait: string;
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
