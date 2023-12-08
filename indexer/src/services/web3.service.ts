import { Injectable, Logger } from '@nestjs/common';

import { FormattedTransaction, GetBlockReturnType, TransactionReceipt, createPublicClient, http } from 'viem';
import { goerli, mainnet } from 'viem/chains';

import punkDataAbi from '../abi/PunkData.json';
import pointsAbi from '../abi/Points.json';
import { etherPhunksMarketAbi } from '../abi/EtherPhunksMarket';

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

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

  // Method to get transactions from a specific block
  async getBlockTransactions(n: number): Promise<{
    txns: { transaction: FormattedTransaction; receipt: TransactionReceipt; }[],
    createdAt: Date
  }> {
    const block = await this.client.getBlock({
      includeTransactions: true,
      blockNumber: BigInt(n),
    });

    const ts = Number(block.timestamp);
    const createdAt = new Date(ts * 1000);

    const txArray = block.transactions.filter((txn) => txn.input !== '0x');
    const txns = await Promise.all(txArray.map(async (tx) => {
      return {
        transaction: tx,
        receipt: await this.client.getTransactionReceipt({ hash: tx.hash }),
      };
    }));

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
