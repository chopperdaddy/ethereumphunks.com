import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
// import 'hardhat-log-remover';

import dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: 'mainnet',
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    mainnet: {
      url: 'http://geth.dappnode:8545',
      chainId: 1,
      from: process.env.MAINNET_ADDRESS as string,
      accounts: [`0x${process.env.MAINNET_PK}`],
    },
    goerli: {
      url: 'http://goerli-geth.dappnode:8545',
      chainId: 5,
      from: process.env.GOERLI_ADDRESS as string,
      accounts: [`0x${process.env.GOERLI_PK}`],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
