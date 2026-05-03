import { HardhatUserConfig } from 'hardhat/config';
import { HardhatNetworkUserConfig, NetworksUserConfig } from 'hardhat/types';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
// import 'hardhat-log-remover';

import dotenv from 'dotenv';
dotenv.config();

function privateKeyFromEnv(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return [value.startsWith('0x') ? value : `0x${value}`];
}

const hardhatNetwork: HardhatNetworkUserConfig = {
  chainId: 1337,
};

if (process.env.FORK_RPC_URL) {
  hardhatNetwork.forking = {
    enabled: true,
    url: process.env.FORK_RPC_URL,
  };
}

const networks: NetworksUserConfig = {
  hardhat: hardhatNetwork,
};

if (process.env.MAINNET_RPC_URL && process.env.MAINNET_PK) {
  networks.mainnet = {
    url: process.env.MAINNET_RPC_URL,
    chainId: 1,
    accounts: privateKeyFromEnv(process.env.MAINNET_PK),
  };
}

if (process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_PK) {
  networks.sepolia = {
    url: process.env.SEPOLIA_RPC_URL,
    chainId: 11155111,
    accounts: privateKeyFromEnv(process.env.SEPOLIA_PK),
  };
}

if (process.env.MAGMA_RPC_URL && process.env.MAGMA_PK) {
  networks.magma = {
    url: process.env.MAGMA_RPC_URL,
    chainId: 6969696969,
    accounts: privateKeyFromEnv(process.env.MAGMA_PK),
  };
}

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
    sources: process.env.HARDHAT_SOURCES_PATH || './contracts/AuctionHouse',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks,
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
