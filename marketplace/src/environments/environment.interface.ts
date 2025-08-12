export interface AgentConfig {
  enabled: boolean;
  address: string;
  name: string;
  env: 'dev' | 'local' | 'production' | undefined;
}

export interface Environment {
  // App configuration
  version: string;
  standalone: boolean;
  defaultCollection: string;
  agent: AgentConfig;

  // Environment specific
  env: string;
  production: boolean;
  chainId: number;

  // Network providers
  rpcHttpProvider: string;
  explorerUrl: string;
  externalMarketUrl: string;
  magmaRpcHttpProvider: string;

  // Contract addresses
  pointsAddress: string;
  donationsAddress: string;
  marketAddress: string;
  marketAddressL2: string;
  bridgeAddress: string;
  bridgeAddressL2: string;
  auctionHouseAddress: string;

  // Service URLs
  relayUrl: string;
  staticUrl: string;

  // Supabase configuration
  supabaseUrl: string;
  supabaseKey: string;
}
