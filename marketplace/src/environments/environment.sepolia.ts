import { appConfig } from './app';
import { Environment } from './environment.interface';

export const environment: Environment = {
  ...appConfig,

  env: 'sepolia',
  production: true,
  chainId: 11155111,

  rpcHttpProvider: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorerUrl: 'https://sepolia.etherscan.io',
  externalMarketUrl: 'https://sepolia.ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  pointsAddress: '0x2a953aa14e986b0595a0c5201dd267391bf7d39d'.toLowerCase(),
  donationsAddress: '0x26e8fd77346b4b006c5df61f9706581933560f12'.toLowerCase(),
  marketAddress: '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e'.toLowerCase(),
  marketAddressL2: '0x005918E10Ed039807a62c564C72D527BaB15c987'.toLowerCase(),
  bridgeAddress: '0x1565f60D2469F18bBCc96B2C29220412F2Fe98Bd'.toLowerCase(),
  bridgeAddressL2: '0x2A953aA14e986b0595A0c5201dD267391BF7d39d'.toLowerCase(),
  auctionHouseAddress: '0x3A50E6D0F8d1c68cD2DD1510a982323805272d48'.toLowerCase(),

  relayUrl: 'https://relay-sepolia.ethereumphunks.com',
  staticUrl: 'https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public',

  // Prod
  supabaseUrl: 'https://kcbuycbhynlmsrvoegzp.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY',
};
