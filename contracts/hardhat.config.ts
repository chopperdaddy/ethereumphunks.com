import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
// import 'hardhat-log-remover';

import dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
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
    sources: './contracts/V2Sepolia',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 1337,
      // forking: {
      //   enabled: true,
      //   url: 'https://eth-mainnet.g.alchemy.com/v2/yPJzT7r3rcFmI4ekjA9S7S1SP688b-au',
      //   blockNumber: 20452276,
      // },
    },
    // mainnet: {
    //   url: 'http://nethermind.public.dappnode:8545',
    //   chainId: 1,
    //   from: process.env.MAINNET_ADDRESS as string,
    //   accounts: [`0x${process.env.MAINNET_PK}`],
    // },
    // sepolia: {
    //   url: 'https://eth-sepolia.g.alchemy.com/v2/OqgMO6w1GkPD6ola3_0kN7ZHHOSA99zS',
    //   chainId: 11155111,
    //   from: process.env.SEPOLIA_ADDRESS as string,
    //   accounts: [`0x${process.env.SEPOLIA_PK}`],
    // },
    // magma: {
    //   url: 'https://turbo.magma-rpc.com',
    //   chainId: 6969696969,
    //   from: process.env.SEPOLIA_ADDRESS as string,
    //   accounts: [`0x${process.env.SEPOLIA_PK}`],
    // },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    // customChains: [
    //   {
    //     network: 'magma',
    //     chainId: 6969696969,
    //     urls: {
    //       apiURL: 'https://magmascan.org/api/',
    //       browserURL: "https://magmascan.org",
    //     }
    //   }
    // ]
  },
};

export default config;
