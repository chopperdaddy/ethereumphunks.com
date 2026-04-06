-- Migration: Add auctions column to _global_config table
-- Date: 2025-05-14
-- Description: Adds auctions column to _global_config table to match the seed data

-- Add auctions column to _global_config table
ALTER TABLE "_global_config"
ADD COLUMN "auctions" boolean DEFAULT true NOT NULL;

-- Add comment to the new column
COMMENT ON COLUMN "_global_config"."auctions" IS 'Whether auctions are enabled globally';
