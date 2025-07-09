import { type ReadContractReturnType } from 'viem';
import { auctionHouseL1 } from '@/abi/AuctionHouseL1';
import { Auction } from './db';

// Get the exact return type from getAuction function
export type AuctionResult = ReadContractReturnType<
  typeof auctionHouseL1,
  'getAuction'
>;

export interface AuctionRequest {
  prevOwner: string; // address
  hashId: string; // bytes32
}

// Raw auction data as returned from contract (with bigints)
export interface RawAuction {
  hashId: string;
  owner: string;
  amount: bigint;
  startTime: bigint;
  endTime: bigint;
  bidder: string;
  settled: boolean;
  auctionId: bigint;
  duration: bigint;
  minBidIncrementPercentage: number; // uint8 is already a number
  timeBuffer: bigint;
}

// Type-safe conversion utility
export function formatAuction(auction: AuctionResult): Auction {
  return {
    hashId: auction.hashId,
    prevOwner: auction.owner,
    amount: auction.amount.toString(),
    startTime: new Date(Number(auction.startTime) * 1000).toISOString(),
    endTime: new Date(Number(auction.endTime) * 1000).toISOString(),
    bidder: auction.bidder,
    settled: auction.settled,
    auctionId: Number(auction.auctionId),
    duration: Number(auction.duration),
    minBidIncrementPercentage: Number(auction.minBidIncrementPercentage),
    timeBuffer: Number(auction.timeBuffer),
  };
}

// Type guard to check if auction exists
export function isValidAuction(auction: Auction | null): auction is Auction {
  return auction !== null && auction.hashId !== '0x0000000000000000000000000000000000000000000000000000000000000000';
}
