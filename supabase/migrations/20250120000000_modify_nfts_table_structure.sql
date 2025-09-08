-- Migration to modify NFTs table structure for all chains
-- Add contractAddress column, make hashId nullable, remove constraints, and create new primary key

-- Apply changes to main chain NFTs table
-- Step 1: Drop existing constraints
ALTER TABLE nfts DROP CONSTRAINT IF EXISTS nfts_pkey;
ALTER TABLE nfts DROP CONSTRAINT IF EXISTS nfts_tokenId_key;
ALTER TABLE nfts DROP CONSTRAINT IF EXISTS nfts_hashId_fkey;

-- Step 2: Add contractAddress column
ALTER TABLE nfts ADD COLUMN "contractAddress" text DEFAULT '';

-- Step 3: Make hashId nullable
ALTER TABLE nfts ALTER COLUMN "hashId" DROP NOT NULL;

-- Step 4: Remove default from contractAddress after adding it
ALTER TABLE nfts ALTER COLUMN "contractAddress" DROP DEFAULT;

-- Step 5: Create new primary key using hashId, contractAddress, and tokenId combination
-- Update empty contract addresses to NULL
UPDATE nfts SET "contractAddress" = NULL WHERE "contractAddress" = '';
ALTER TABLE nfts ADD CONSTRAINT nfts_pkey PRIMARY KEY ("hashId", "contractAddress", "tokenId");

-- Step 6: hashId is now part of primary key, so no separate index needed

-- Step 7: Add index on owner for performance
CREATE INDEX IF NOT EXISTS idx_nfts_owner ON nfts("owner");

-- Step 8: Add foreign key constraint linking contractAddress to collections table
-- Add the foreign key constraint
ALTER TABLE nfts ADD CONSTRAINT nfts_contractAddress_fkey
    FOREIGN KEY ("contractAddress") REFERENCES collections("contractAddress");

-- Apply changes to Sepolia chain NFTs table
-- Step 1: Drop existing constraints
ALTER TABLE nfts_sepolia DROP CONSTRAINT IF EXISTS nfts_sepolia_pkey;
ALTER TABLE nfts_sepolia DROP CONSTRAINT IF EXISTS nfts_sepolia_tokenId_key;
ALTER TABLE nfts_sepolia DROP CONSTRAINT IF EXISTS nfts_sepolia_hashId_fkey;

-- Step 2: Add contractAddress column
ALTER TABLE nfts_sepolia ADD COLUMN "contractAddress" text DEFAULT '';

-- Step 3: Make hashId nullable
ALTER TABLE nfts_sepolia ALTER COLUMN "hashId" DROP NOT NULL;

-- Step 4: Remove default from contractAddress after adding it
ALTER TABLE nfts_sepolia ALTER COLUMN "contractAddress" DROP DEFAULT;

-- Step 5: Create new primary key using hashId, contractAddress, and tokenId combination
-- Update empty contract addresses to NULL
UPDATE nfts_sepolia SET "contractAddress" = NULL WHERE "contractAddress" = '';
ALTER TABLE nfts_sepolia ADD CONSTRAINT nfts_sepolia_pkey PRIMARY KEY ("hashId", "contractAddress", "tokenId");

-- Step 6: hashId is now part of primary key, so no separate index needed

-- Step 7: Add index on owner for performance
CREATE INDEX IF NOT EXISTS idx_nfts_sepolia_owner ON nfts_sepolia("owner");

-- Step 8: Add foreign key constraint linking contractAddress to collections_sepolia table
-- Add the foreign key constraint
ALTER TABLE nfts_sepolia ADD CONSTRAINT nfts_sepolia_contractAddress_fkey
    FOREIGN KEY ("contractAddress") REFERENCES collections_sepolia("contractAddress");
