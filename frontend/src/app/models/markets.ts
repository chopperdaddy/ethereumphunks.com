import { Contract } from 'ethers';
// import { Contract as Web3Contract } from 'web3-eth-contract'
// import { AbiItem } from 'web3-utils';

export interface Markets {
  [type: string]: Market,
  titles?: any;
}

interface Market {
  name: string;
  nameSin: string;
  shortName: string;
  shortNameSin: string;
  baseURL: string;
  titles: any;
  dataKeys: any;
  featured: Array<number>;
  // tokenContract: Web3Contract | null;
  // marketContract: Web3Contract | null;
  tokenAddress: string;
  marketAddress: string;
  wrappedPunks?: Array<number>;
  routes: {
    owned: string;
  };
  abis: {
    // tokenABI: AbiItem | AbiItem[];
    // marketABI: AbiItem | AbiItem[];
  }
}