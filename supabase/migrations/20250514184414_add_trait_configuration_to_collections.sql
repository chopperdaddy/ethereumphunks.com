-- Add trait configuration columns to collections tables
ALTER TABLE public.collections
ADD COLUMN "ignoredTraitFilters" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "ignoredTraitFiltersForCounts" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "mainTrait" text;

-- Add the same columns to collections_sepolia since it's a mirror
ALTER TABLE public.collections_sepolia
ADD COLUMN "ignoredTraitFilters" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "ignoredTraitFiltersForCounts" jsonb DEFAULT '[]' NOT NULL,
ADD COLUMN "mainTrait" text;
