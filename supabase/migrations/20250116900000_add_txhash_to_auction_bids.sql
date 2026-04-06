-- Migration: Add txHash column to auctionBids tables
-- Date: 2025-05-14
-- Description: Adds txHash column to auctionBids and auctionBids_sepolia tables to match the seed data

-- Add txHash column to auctionBids table (mainnet)
ALTER TABLE "auctionBids"
ADD COLUMN "txHash" "text";

-- Add txHash column to auctionBids_sepolia table
ALTER TABLE "auctionBids_sepolia"
ADD COLUMN "txHash" "text";

-- Add comments to the new columns
COMMENT ON COLUMN "auctionBids"."txHash" IS 'Transaction hash of the bid';
COMMENT ON COLUMN "auctionBids_sepolia"."txHash" IS 'Transaction hash of the bid';
