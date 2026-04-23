-- Migration: Add attributeOrder to collections tables
-- Description: Stores per-collection trait display order for marketplace UI sorting

ALTER TABLE public.collections
ADD COLUMN "attributeOrder" text[];

COMMENT ON COLUMN public.collections."attributeOrder" IS
'Ordered list of trait keys for collection-specific attribute/filter display.';

ALTER TABLE public.collections_sepolia
ADD COLUMN "attributeOrder" text[];

COMMENT ON COLUMN public.collections_sepolia."attributeOrder" IS
'Ordered list of trait keys for collection-specific attribute/filter display.';

CREATE OR REPLACE FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer DEFAULT 25, "show_inactive" boolean DEFAULT false)
RETURNS TABLE("ethscription" "json")
LANGUAGE "plpgsql"
AS $$BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', c.id,
        'slug', c.slug,
        'name', c.name,
        'description', c.description,
        'singleName', c."singleName",
        'image', c.image,
        'supply', c.supply,
        'active', c.active,
        'mintEnabled', c."mintEnabled",
        'isMinting', c."isMinting",
        'hasBackgrounds', c."hasBackgrounds",
        'createdAt', c."createdAt",
        'posterHashId', c."posterHashId",
        'website', c.website,
        'twitter', c.twitter,
        'discord', c.discord,
        'notifications', c.notifications,
        'defaultBackground', c."defaultBackground",
        'standalone', c.standalone,
        'adminAddress', c."adminAddress",
        'ignoredTraitFilters', c."ignoredTraitFilters",
        'ignoredTraitFiltersForCounts', c."ignoredTraitFiltersForCounts",
        'mainTrait', c."mainTrait",
        'attributeOrder', c."attributeOrder",
        'contractAddress', c."contractAddress",
        'type', c."type",
        'previews', json_agg(json_build_object(
            'hashId', e."hashId",
            'tokenId', e."tokenId",
            'slug', c.slug,
            'sha', e.sha
        )) FILTER (WHERE e."hashId" IS NOT NULL)
    )
    FROM public.collections c
    LEFT JOIN LATERAL (
        SELECT e."hashId", e."tokenId", e.sha
        FROM public.ethscriptions e
        WHERE e.slug = c.slug
        ORDER BY RANDOM()
        LIMIT preview_limit
    ) e ON true
    WHERE
        (CASE
            WHEN show_inactive = TRUE THEN c.active = FALSE
            ELSE c.active = TRUE
        END)
    GROUP BY c.id, c.slug, c.name, c.image, c.description, c."singleName", c.supply, c.active,
             c."mintEnabled", c."isMinting", c."hasBackgrounds", c."createdAt", c."posterHashId",
             c.website, c.twitter, c.discord, c.notifications, c."defaultBackground", c.standalone,
             c."adminAddress", c."ignoredTraitFilters", c."ignoredTraitFiltersForCounts",
             c."mainTrait", c."attributeOrder", c."contractAddress", c."type";
END;$$;

CREATE OR REPLACE FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer DEFAULT 25, "show_inactive" boolean DEFAULT false)
RETURNS TABLE("ethscription" "json")
LANGUAGE "plpgsql"
AS $$BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', c.id,
        'slug', c.slug,
        'name', c.name,
        'description', c.description,
        'singleName', c."singleName",
        'image', c.image,
        'supply', c.supply,
        'active', c.active,
        'mintEnabled', c."mintEnabled",
        'isMinting', c."isMinting",
        'hasBackgrounds', c."hasBackgrounds",
        'createdAt', c."createdAt",
        'posterHashId', c."posterHashId",
        'website', c.website,
        'twitter', c.twitter,
        'discord', c.discord,
        'notifications', c.notifications,
        'defaultBackground', c."defaultBackground",
        'standalone', c.standalone,
        'adminAddress', c."adminAddress",
        'ignoredTraitFilters', c."ignoredTraitFilters",
        'ignoredTraitFiltersForCounts', c."ignoredTraitFiltersForCounts",
        'mainTrait', c."mainTrait",
        'attributeOrder', c."attributeOrder",
        'contractAddress', c."contractAddress",
        'type', c."type",
        'previews', json_agg(json_build_object(
            'hashId', e."hashId",
            'tokenId', e."tokenId",
            'slug', c.slug,
            'sha', e.sha
        )) FILTER (WHERE e."hashId" IS NOT NULL)
    )
    FROM public.collections_sepolia c
    LEFT JOIN LATERAL (
        SELECT e."hashId", e."tokenId", e.sha
        FROM public.ethscriptions_sepolia e
        WHERE e.slug = c.slug
        ORDER BY RANDOM()
        LIMIT preview_limit
    ) e ON true
    WHERE
        (CASE
            WHEN show_inactive = TRUE THEN c.active = FALSE
            ELSE c.active = TRUE
        END)
    GROUP BY c.id, c.slug, c.name, c.image, c.description, c."singleName", c.supply, c.active,
             c."mintEnabled", c."isMinting", c."hasBackgrounds", c."createdAt", c."posterHashId",
             c.website, c.twitter, c.discord, c.notifications, c."defaultBackground", c.standalone,
             c."adminAddress", c."ignoredTraitFilters", c."ignoredTraitFiltersForCounts",
             c."mainTrait", c."attributeOrder", c."contractAddress", c."type";
END;$$;
