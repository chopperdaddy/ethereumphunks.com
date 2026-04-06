-- Add trait configuration columns to collections tables
ALTER TABLE public.collections
ADD COLUMN "ignoredTraitFilters" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "ignoredTraitFiltersForCounts" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "mainTrait" text,
ADD COLUMN "contractAddress" text DEFAULT NULL,
ADD COLUMN "type" text CHECK ("type" IN ('nft', 'inscription'));

-- Add the same columns to collections_sepolia since it's a mirror
ALTER TABLE public.collections_sepolia
ADD COLUMN "ignoredTraitFilters" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "ignoredTraitFiltersForCounts" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "mainTrait" text,
ADD COLUMN "contractAddress" text DEFAULT NULL,
ADD COLUMN "type" text CHECK ("type" IN ('nft', 'inscription'));

-- Add unique constraints for contract addresses
ALTER TABLE public.collections ADD CONSTRAINT "collections_contractAddress_unique" UNIQUE ("contractAddress");
ALTER TABLE public.collections_sepolia ADD CONSTRAINT "collections_sepolia_contractAddress_unique" UNIQUE ("contractAddress");

