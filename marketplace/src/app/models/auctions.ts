import { type ReadContractReturnType } from 'viem';
import { auctionHouseL1 } from '@/abi/AuctionHouseL1';

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

// Formatted auction data (bigints converted to numbers)
export interface FormattedAuction {
  hashId: string;
  owner: string;
  amount: number;
  startTime: number;
  endTime: number;
  bidder: string;
  settled: boolean;
  auctionId: number;
  duration: number;
  minBidIncrementPercentage: number;
  timeBuffer: number;
}

// Type-safe conversion utility
export function formatAuction(auction: AuctionResult): FormattedAuction {
  return {
    hashId: auction.hashId,
    owner: auction.owner,
    amount: Number(auction.amount),
    startTime: Number(auction.startTime),
    endTime: Number(auction.endTime),
    bidder: auction.bidder,
    settled: auction.settled,
    auctionId: Number(auction.auctionId),
    duration: Number(auction.duration),
    minBidIncrementPercentage: auction.minBidIncrementPercentage,
    timeBuffer: Number(auction.timeBuffer),
  };
}

// Type guard to check if auction exists
export function isValidAuction(auction: AuctionResult | null): auction is AuctionResult {
  return auction !== null && auction.hashId !== '0x0000000000000000000000000000000000000000000000000000000000000000';
}
