import { Injectable, Logger } from '@nestjs/common';

import { FormattedTransaction, GetBlockReturnType, TransactionReceipt, createPublicClient, createWalletClient, http, parseEther, parseGwei, parseUnits, toHex } from 'viem';
import { goerli, mainnet, sepolia } from 'viem/chains';

import punkDataAbi from '../abi/PunkData.json';
import pointsAbi from '../abi/Points.json';
import { etherPhunksMarketAbi } from '../abi/EtherPhunksMarket';

import { privateKeyToAccount } from 'viem/accounts'

import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
dotenv.config();

@Injectable()
export class Web3Service {

  marketAddress = (process.env.MARKET_ADDRESS).toLowerCase();
  auctionAddress = (process.env.AUCTION_ADDRESS).toLowerCase();
  pointsAddress = (process.env.POINTS_ADDRESS).toLowerCase();

  chain: 'mainnet' | 'sepolia' = process.env.CHAIN_ID === '1' ? 'mainnet' : 'sepolia';
  rpcURL: string = this.chain === 'mainnet' ? process.env.RPC_URL_MAINNET : process.env.RPC_URL_SEPOLIA;

  public client = createPublicClient({
    chain: this.chain === 'mainnet' ? mainnet : sepolia,
    transport: http(this.rpcURL)
  });

  private walletClient = createWalletClient({
    chain: this.chain === 'mainnet' ? mainnet : sepolia,
    transport: http(this.rpcURL),
    account: privateKeyToAccount(`0x${process.env.SEPOLIA_PK}`),
  });

  constructor() {
    Logger.log(`Using ${this.chain} chain`);

    // this.getAllBids();
    // this.getStolen();
  }

  async getAllBids(): Promise<any> {

    const stolen = `653080de657271f70bcbb283cb39ba59c2559b614f47148e2877821d9872458c148a7258ce48507292c27864a47de0bf89a52454365cbf4fa80c1c5d02bb4660abe91d9ee37bbb25e7adb8ebbde44a7144cd8a6a20f8ce86f4e208890f5b5d3a58e81efb86f58f5cb1251c13e3c99ba7b68f7e98d475b6cb5403b4a20b18dede004968b4089ef9e94392ae1f6872d302429165a24adf5ad06cd8f50119d24d8cddebf1afa1f38d20f72aa1a726f1690025283357b34ceb4347f851456837d5b9e096678044f1b4f084a4cc07522e6cf7ded8b71d40e2ef0afea56606862d23fbed3bfede8e572361e9f68524bb88081a94e948398d1418a7cf451bf66a53a48f02306579b536541fee16872afd496f8e0dc0761bae2112a83a1286b7adbb40e4064d636437a2fd857168ac065559e7a1453499f233e3bcd7595142ad82a78e7055de9fea826151c6f0fe273a8cc9cceef959ac0ee8c9e975db77b7d5fa016fd97e67dc298f863796925a79230f0477af5ea07daff63590eaec6660fc35ceffc7a40f015a8b36e49f7b2f3d86f48eacc769c4d599171aad3ee237118d61c417f9c3a8ef058226316100eaf283eb2b4494933b9ae20eb6c8521d3dbd77f1984c29`.match(/.{1,64}/g).map((x) => `0x${x}`.toLowerCase());

    const bidEnteredLogs: any = await this.client.getContractEvents({
      abi: etherPhunksMarketAbi,
      address: this.marketAddress as `0x${string}`,
      eventName: 'PhunkBidEntered',
      fromBlock: BigInt(18896155),
      toBlock: BigInt(19071987),
    });

    const bids: any = {};
    for (let i = 0; i < bidEnteredLogs.length; i++) {
      const log = bidEnteredLogs[i];
      const { blockNumber, transactionHash } = log;
      const { phunkId, fromAddress, value } = log.args;

      bids[phunkId] = {
        phunkId,
        fromAddress,
        value: value.toString(),
        blockNumber: Number(blockNumber),
        transactionHash,
      };
    }

    Object.keys(bids).forEach((phunkId: string) => {
      const bid = bids[phunkId];
      if (!stolen.includes(bid.phunkId)) delete bids[phunkId];
    });

    const refunds = {};
    let total = 0;
    for (let i = 0; i < Object.keys(bids).length; i++) {
      const phunkId = Object.keys(bids)[i];
      const bid = bids[phunkId];
      const address = bid.fromAddress.toLowerCase();

      const ethAmount = Number(bid.value) / 10 ** 18;
      refunds[address] = (refunds[address] || 0) + ethAmount;
      total += ethAmount;
    }

    console.log('refunds', { refunds, total });

    await writeFile('./bids.json', JSON.stringify({ refunds, total }));
  }

  async getStolen() {
    const acceptBidLogs: any = await this.client.getContractEvents({
      abi: etherPhunksMarketAbi,
      address: this.marketAddress as `0x${string}`,
      eventName: 'PhunkBought',
      fromBlock: BigInt(19072085),
      toBlock: BigInt(19072127),
    });

    // console.log(acceptBidLogs)

    const refunds = {};
    let total = 0;
    for (let i = 0; i < acceptBidLogs.length; i++) {
      const log = acceptBidLogs[i];
      const { phunkId, toAddress, value } = log.args;

      const ethAmount = Number(value) / 10 ** 18;
      refunds[toAddress.toLowerCase()] = (refunds[toAddress.toLowerCase()] || 0) + ethAmount;
      total += ethAmount;
    }

    console.log('refunds', { refunds, total });
  }

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

  async getAllListingEvents(): Promise<any> {
    const filter: any = await this.client.createContractEventFilter({
      abi: etherPhunksMarketAbi,
      address: `0xd3418772623be1a3cc6b6d45cb46420cedd9154a`,
      eventName: 'PhunkOffered',
      fromBlock: BigInt(18896155),
      toBlock: BigInt(18972289),
    });

    const logs = await this.client.getFilterLogs({ filter })

    logs.forEach(async (log: any) => {
      const tx = await this.getTransaction(log.transactionHash);
      const from = tx.from;

      const phunkId = log.args[0];
      const minValue = log.args[2];
      // console.log(log.args)
    });
  }

  async getPoints(address: `0x${string}`): Promise<number> {
    const points = await this.client.readContract({
      address: this.pointsAddress as `0x${string}`,
      abi: pointsAbi,
      functionName: 'points',
      args: [`${address}`],
    });
    return points as number;
  }

  async addPoints(address: `0x${string}`, amount: number): Promise<string> {
    const txHash = await this.walletClient.writeContract({
      account: privateKeyToAccount(`0x${process.env.SEPOLIA_PK}`),
      abi: pointsAbi,
      chain: sepolia,
      address: '0x2A953aA14e986b0595A0c5201dD267391BF7d39d',
      functionName: 'addPoints',
      args: [`${address}`, amount],
    });
    return txHash;
  }

  async getGoerliPoints(address: `0x${string}`): Promise<number> {
    const client = createPublicClient({
      chain: goerli,
      transport: http('https://eth-goerli.g.alchemy.com/v2/Oq4QaAbjSOc5d3XuyaWcpMutW6jU8-6s'),
    });

    const points = await client.readContract({
      address: '0x8974D44dAD885699155c17934E6d33135d85380F',
      abi: pointsAbi,
      functionName: 'points',
      args: [`${address}`],
    });
    return Number(points);
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

  async pendingWithdrawals(address: string): Promise<bigint> {
    const pendingWithdrawals = await this.client.readContract({
      address: this.marketAddress as `0x${string}`,
      abi: etherPhunksMarketAbi,
      functionName: 'pendingWithdrawals',
      args: [address],
      blockNumber: BigInt(19125912),
      blockTag: 'safe',
    });
    return pendingWithdrawals as bigint;
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Wallet Actions /////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  async ethscribe(imageData: string, to: string): Promise<string> {

    const txHash = await this.walletClient.sendTransaction({
      account: privateKeyToAccount(`0x${process.env.SEPOLIA_PK}`),
      chain: sepolia,
      to: to as `0x${string}`,
      value: BigInt(0),
      data: toHex(imageData),
      maxPriorityFeePerGas: parseGwei('2.5')
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
