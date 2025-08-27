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
  // staticUrl: 'https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public',
  relayUrl: 'https://relay.ethereumphunks.com',
  staticUrl: 'https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public',

  // supabaseUrl: 'http://127.0.0.1:54321',
  // supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  supabaseUrl: 'https://kcbuycbhynlmsrvoegzp.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY',
};
