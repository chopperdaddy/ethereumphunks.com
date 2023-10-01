export const environment = {
  env: 'dev-goerli',
  production: false,
  // graphURI: 'https://api.studio.thegraph.com/query/4302/cryptophunks_eth_goerli/version/latest',
  staticUrl: 'https://punkcdn.com/static',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY',
  // staticUrl: 'http://localhost:3001',
  phunksMarketAddress: '0x39f36a2C8fB4aC617856F7fa5906265074608777'.toLowerCase(),
  startBlock: 0,
  rpcHttpProvider: 'http://goerli-geth.dappnode:8545',
  chainId: 5,
};
