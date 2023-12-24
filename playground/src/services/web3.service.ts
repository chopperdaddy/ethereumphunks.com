import { Injectable, Logger } from '@nestjs/common';

import { FormattedTransaction, GetBlockReturnType, TransactionReceipt, createPublicClient, createWalletClient, http, toHex } from 'viem';
import { goerli, mainnet } from 'viem/chains';

import punkDataAbi from '../abi/PunkData.json';
import pointsAbi from '../abi/Points.json';
import { etherPhunksMarketAbi } from '../abi/EtherPhunksMarket';

import { privateKeyToAccount } from 'viem/accounts'

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class Web3Service {

  marketAddress = (process.env.MARKET_ADDRESS).toLowerCase();
  auctionAddress = (process.env.AUCTION_ADDRESS).toLowerCase();
  pointsAddress = (process.env.POINTS_ADDRESS).toLowerCase();

  chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';
  rpcURL: string = this.chain === 'goerli' ? process.env.RPC_URL_GOERLI : process.env.RPC_URL_MAINNET;

  public client = createPublicClient({
    chain: this.chain === 'goerli' ? goerli : mainnet,
    transport: http(this.rpcURL)
  });

  private walletClient = createWalletClient({
    chain: this.chain === 'goerli' ? goerli : mainnet,
    transport: http(this.rpcURL),
    account: privateKeyToAccount(`0x${process.env.GOERLI_PK}`),
  });

  // Method to get transactions from a specific block
  async getBlockTransactions(n: number): Promise<{
    txns: FormattedTransaction[];
    createdAt: Date
  }> {
    const block = await this.client.getBlock({
      includeTransactions: true,
      blockNumber: BigInt(n),
    });

    const ts = Number(block.timestamp);
    const createdAt = new Date(ts * 1000);
    const txns = block.transactions;

    return { txns, createdAt };
  }

  async getTransaction(hash: `0x${string}`): Promise<any> {
    const transaction = await this.client.getTransaction({ hash });
    return transaction;
  }

  async getTransactionReceipt(hash: `0x${string}`): Promise<TransactionReceipt> {
    const receipt = await this.client.getTransactionReceipt({ hash });
    return receipt;
  }

  async getBlock(n?: number): Promise<GetBlockReturnType> {
    if (n) return await this.client.getBlock({ blockNumber: BigInt(n), includeTransactions: false });
    return await this.client.getBlock({ includeTransactions: false });
  }

  ///////////////////////////////////////////////////////////////////////////////
  // EtherPhunks smart contract interactions ////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  async getPoints(address: `0x${string}`): Promise<number> {
    const points = await this.client.readContract({
      address: this.pointsAddress as `0x${string}`,
      abi: pointsAbi,
      functionName: 'points',
      args: [`${address}`],
    });
    return points as number;
  }

  async userEthscriptionPossiblyStored(prevOwner: string, hashId: string): Promise<boolean> {
    const isInEscrow = await this.client.readContract({
      address: this.marketAddress as `0x${string}`,
      abi: etherPhunksMarketAbi,
      functionName: 'userEthscriptionPossiblyStored',
      args: [prevOwner, hashId],
    });
    return isInEscrow as boolean;
  }

  async phunkBids(hashId: string): Promise<[
    hasBid: boolean,
    phunkId: string,
    bidder: string,
    value: string,
  ]> {
    const abi = [{
      inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      name: 'phunkBids',
      outputs: [
        { internalType: 'bool', name: 'hasBid', type: 'bool' },
        { internalType: 'bytes32', name: 'phunkId', type: 'bytes32' },
        { internalType: 'address', name: 'bidder', type: 'address' },
        { internalType: 'uint256', name: 'value', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    }];
    const bid = await this.client.readContract({
      address: this.marketAddress as `0x${string}`,
      abi,
      functionName: 'phunkBids',
      args: [hashId as `0x${string}`],
    });
    return bid as any;
  }

  async phunksOfferedForSale(hashId: string): Promise<[
    isForSale: boolean,
    phunkId: string,
    seller: string,
    minValue: string,
    onlySellTo: string,
  ]> {
    const abi = [{
      inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      name: 'phunksOfferedForSale',
      outputs: [
        { internalType: 'bool', name: 'isForSale', type: 'bool' },
        { internalType: 'bytes32', name: 'phunkId', type: 'bytes32' },
        { internalType: 'address', name: 'seller', type: 'address' },
        { internalType: 'uint256', name: 'minValue', type: 'uint256' },
        { internalType: 'address', name: 'onlySellTo', type: 'address' },
      ],
      stateMutability: 'view',
      type: 'function',
    }];
    const isListed = await this.client.readContract({
      address: this.marketAddress as `0x${string}`,
      abi,
      functionName: 'phunksOfferedForSale',
      args: [hashId as `0x${string}`],
    });
    return isListed as any;
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Wallet Actions /////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  async ethscribe(imageData: string, to: string): Promise<string> {

    const txHash = await this.walletClient.sendTransaction({
      account: privateKeyToAccount(`0x${process.env.GOERLI_PK}`),
      chain: goerli,
      to: to as `0x${string}`,
      value: BigInt(0),
      data: toHex(imageData),
    })

    return txHash;
  }

  async waitForTransactionReceipt(hash: `0x${string}`): Promise<TransactionReceipt> {
    return await this.client.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Punk data contract interactions ////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  async getPunkImage(tokenId: number): Promise<any> {
    const punkImage = await this.client.readContract({
      address: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2' as `0x${string}`,
      abi: punkDataAbi,
      functionName: 'punkImageSvg',
      args: [`${tokenId}`],
    });
    return punkImage as any;
  }

  async getPunkAttributes(tokenId: number): Promise<any> {
    const punkAttributes = await this.client.readContract({
      address: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2' as `0x${string}`,
      abi: punkDataAbi,
      functionName: 'punkAttributes',
      args: [`${tokenId}`],
    });
    return punkAttributes as any;
  }
}
