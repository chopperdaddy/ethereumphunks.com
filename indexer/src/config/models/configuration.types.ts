export type AppConfig = {
  nodeEnv: string;
  port: number;
  allowedOrigins: string[];
  bridgeBlockDelay: number;
  features: Features;
  chain: ChainConfig;
  relay: RelayConfig;
  notifications: NotificationsConfig;
  api: ApiConfig;
  supabase: SupabaseConfig;
};

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export type Features = {
  queue: number;
  bridge: number;
  discord: number;
  twitter: number;
  telegram: number;
  txPool: number;
  mint: number;
};

export type ChainConfig = {
  chainIdL1: number;
  chainIdL2: number;
  contracts: {
    market: {
      l1: `0x${string}`;
      l2: `0x${string}`;
    };
    points: {
      l1: `0x${string}`;
      l2: `0x${string}`;
    };
    bridge: {
      l1: `0x${string}`;
      l2: `0x${string}`;
    };
    auctionHouse: {
      l1: `0x${string}`;
    };
  };
  rpc: {
    l1: {
      primary: string;
      backup?: string;
    };
    l2: {
      primary: string;
      backup?: string;
    };
  };
};

export type RelayConfig = {
  l1: {
    address: `0x${string}`;
    privateKey: string;
  };
  l2: {
    address: `0x${string}`;
    privateKey: string;
  };
};

export type NotificationsConfig = {
  telegram?: {
    chatId: string;
    botToken: string;
  };
  discord?: {
    botToken: string;
  };
  twitter: {
    username: string;
    password: string;
    twoFactorSecret: string;
  };
};

export type ApiConfig = {
  publicKey: string;
  privateKey: string;
};
