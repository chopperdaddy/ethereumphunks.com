import { appConfig } from './app';
import { Environment } from './environment.interface';

export const environment: Environment = {
  ...appConfig,

  env: 'dev-sepolia',
  production: false,
  chainId: 11155111,

  // rpcHttpProvider: 'http://geth.sepolia-geth.dappnode:8545',
  // rpcHttpProvider: 'https://eth-sepolia.g.alchemy.com/v2/0FN3yRRyJYmfFlfvjco_d9Y8HaVBIH45',
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

  // relayUrl: 'https://relay-sepolia.ethereumphunks.com',
  // staticUrl: 'https://oafirqjkcmgmjononxiy.supabase.co/storage/v1/object/public',
  relayUrl: 'http://localhost:3069',
  staticUrl: 'http://127.0.0.1:54321/storage/v1/object/public',

  // supabaseUrl: 'https://oafirqjkcmgmjononxiy.supabase.co',
  // supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZmlycWprY21nbWpvbm9ueGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjkxMjIsImV4cCI6MjA3OTEyOTEyMn0.lbss8jaxkY3TT5fY9D0Gy69oZw9xkIw04CxBPq7HwL4',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
};
