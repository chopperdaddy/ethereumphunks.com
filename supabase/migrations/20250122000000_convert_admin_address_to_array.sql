-- Migration: Convert adminAddress column to an array of admin addresses
-- Date: 2025-01-22
-- Description: Changes adminAddress column from TEXT to TEXT[] in both collections
--              and collections_sepolia tables to support multiple admin addresses

-- Convert adminAddress column to array in collections table (mainnet)
-- First, add the new column as an array
ALTER TABLE collections
ADD COLUMN "adminAddresses" TEXT[];

-- Migrate existing data from single adminAddress to array format
UPDATE collections
SET "adminAddresses" = CASE
  WHEN "adminAddress" IS NOT NULL AND "adminAddress" != ''
  THEN ARRAY["adminAddress"::TEXT]
  ELSE NULL
END;

-- Drop the old single adminAddress column
ALTER TABLE collections
DROP COLUMN "adminAddress";

-- Rename the new column to adminAddress (keeping the same name for compatibility)
ALTER TABLE collections
RENAME COLUMN "adminAddresses" TO "adminAddress";

-- Add comment to the updated column
COMMENT ON COLUMN collections."adminAddress" IS 'Array of Ethereum wallet addresses with admin rights for this collection (lowercase)';

-- Convert adminAddress column to array in collections_sepolia table
-- First, add the new column as an array
ALTER TABLE collections_sepolia
ADD COLUMN "adminAddresses" TEXT[];

-- Migrate existing data from single adminAddress to array format
UPDATE collections_sepolia
SET "adminAddresses" = CASE
  WHEN "adminAddress" IS NOT NULL AND "adminAddress" != ''
  THEN ARRAY["adminAddress"::TEXT]
  ELSE NULL
END;

-- Drop the old single adminAddress column
ALTER TABLE collections_sepolia
DROP COLUMN "adminAddress";

-- Rename the new column to adminAddress (keeping the same name for compatibility)
ALTER TABLE collections_sepolia
RENAME COLUMN "adminAddresses" TO "adminAddress";

-- Add comment to the updated column
COMMENT ON COLUMN collections_sepolia."adminAddress" IS 'Array of Ethereum wallet addresses with admin rights for this collection (lowercase)';

-- Drop old indexes since they won't work with arrays
DROP INDEX IF EXISTS idx_collections_admin_address;
DROP INDEX IF EXISTS idx_collections_sepolia_admin_address;
DROP INDEX IF EXISTS idx_collections_admin_address_not_null;
DROP INDEX IF EXISTS idx_collections_sepolia_admin_address_not_null;

-- Create new indexes using GIN for array operations
CREATE INDEX idx_collections_admin_address_gin ON collections USING GIN("adminAddress");
CREATE INDEX idx_collections_sepolia_admin_address_gin ON collections_sepolia USING GIN("adminAddress");

-- Create partial indexes for non-null admin addresses arrays
CREATE INDEX idx_collections_admin_address_not_null_gin ON collections USING GIN("adminAddress") WHERE "adminAddress" IS NOT NULL;
CREATE INDEX idx_collections_sepolia_admin_address_not_null_gin ON collections_sepolia USING GIN("adminAddress") WHERE "adminAddress" IS NOT NULL;
