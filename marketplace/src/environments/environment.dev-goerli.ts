export const environment = {
  env: 'dev-goerli',
  production: false,
  // graphURI: 'https://api.studio.thegraph.com/query/4302/cryptophunks_eth_goerli/version/latest',
  staticUrl: 'https://punkcdn.com/data',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY',
  // staticUrl: 'http://localhost:3001',
  phunksMarketAddress: '0x58523aa5B583FFc600F8784C273AC38E9491b5ce'.toLowerCase(),
  startBlock: 0,
  rpcHttpProvider: 'http://goerli-geth.dappnode:8545',
  chainId: 5,
};
