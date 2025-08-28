-- Migration: Add adminAddress column to collections tables
-- Date: $(date)
-- Description: Adds adminAddress column to collections and collections_sepolia tables
--              to track which wallet address has admin rights for each collection

-- Add adminAddress column to collections table (mainnet)
ALTER TABLE collections
ADD COLUMN "adminAddress" TEXT;

-- Add comment to the new column
COMMENT ON COLUMN collections."adminAddress" IS 'Ethereum wallet address of the collection admin (lowercase)';

-- Add adminAddress column to collections_sepolia table
ALTER TABLE collections_sepolia
ADD COLUMN "adminAddress" TEXT;

-- Add comment to the new column
COMMENT ON COLUMN collections_sepolia."adminAddress" IS 'Ethereum wallet address of the collection admin (lowercase)';

-- Create indexes for better query performance on adminAddress
CREATE INDEX idx_collections_admin_address ON collections("adminAddress");
CREATE INDEX idx_collections_sepolia_admin_address ON collections_sepolia("adminAddress");

-- Optional: Create a partial index for non-null admin addresses for better performance
CREATE INDEX idx_collections_admin_address_not_null ON collections("adminAddress") WHERE "adminAddress" IS NOT NULL;
CREATE INDEX idx_collections_sepolia_admin_address_not_null ON collections_sepolia("adminAddress") WHERE "adminAddress" IS NOT NULL;
