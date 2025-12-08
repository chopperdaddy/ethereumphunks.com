import { appConfig } from './app';
import { Environment } from './environment.interface';

export const environment: Environment = {
  ...appConfig,

  env: 'dev-mainnet',
  production: false,
  chainId: 1,

  // rpcHttpProvider: 'https://eth-mainnet.g.alchemy.com/v2/19IQKn99eagaaRKD-uSOCE1aYEHLSnmL',
  rpcHttpProvider: 'http://reth.dappnode:8545',
  // rpcHttpProvider: 'https://eth-mainnet.g.alchemy.com/v2/19IQKn99eagaaRKD-uSOCE1aYEHLSnmL',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0xD3418772623Be1a3cc6B6D45CB46420CEdD9154a'.toLowerCase(),
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0x24d667C5195a767819C9313D6ceEC09D0Dc06Cfd'.toLowerCase(),
  bridgeAddress: ''.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),
  auctionHouseAddress: ''.toLowerCase(),

  // relayUrl: 'http://10.0.0.73:3002',
  // staticUrl: 'https://oafirqjkcmgmjononxiy.supabase.co/storage/v1/object/public',
  relayUrl: 'http://localhost:3069',
  staticUrl: 'http://127.0.0.1:54321/storage/v1/object/public',

  // supabaseUrl: 'https://oafirqjkcmgmjononxiy.supabase.co',
  // supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZmlycWprY21nbWpvbm9ueGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjkxMjIsImV4cCI6MjA3OTEyOTEyMn0.lbss8jaxkY3TT5fY9D0Gy69oZw9xkIw04CxBPq7HwL4',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
};
