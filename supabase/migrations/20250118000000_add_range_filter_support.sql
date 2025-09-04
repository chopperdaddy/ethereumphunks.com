-- Migration: Add range filter support to pagination functions
-- This update adds backwards-compatible range filtering (e.g., "3-7") while preserving all existing functionality

-- Drop existing functions to prevent duplicates
DROP FUNCTION IF EXISTS fetch_all_with_pagination_new(text, integer, integer, jsonb);
DROP FUNCTION IF EXISTS fetch_all_with_pagination_new_sepolia(text, integer, integer, jsonb);

-- Update the main network function
CREATE OR REPLACE FUNCTION fetch_all_with_pagination_new(
    p_slug text,
    p_from_num integer,
    p_to_num integer,
    p_filters jsonb,
    p_sort_by text DEFAULT 'id'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB;
    total_count INTEGER;
    filter_count INTEGER;
    trait_count_filter TEXT;
    has_trait_count_filter BOOLEAN;
    collection_trait_exclusions TEXT[];
BEGIN
    -- Get collection-specific trait count exclusions
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(c."ignoredTraitFiltersForCounts")
    )
    INTO collection_trait_exclusions
    FROM collections c
    WHERE c.slug = p_slug;

    -- Check if trait_count filter is present
    SELECT p_filters ->> 'trait_count' INTO trait_count_filter;
    has_trait_count_filter := trait_count_filter IS NOT NULL;

    -- Calculate the number of attribute filters (excluding trait_count)
    SELECT COUNT(*)
    INTO filter_count
    FROM jsonb_each_text(p_filters)
    WHERE key != 'trait_count';

    -- First, calculate the total count with filters applied
    SELECT COUNT(*)
    INTO total_count
    FROM ethscriptions e
    LEFT JOIN attributes_new a ON e.sha = a.sha
    WHERE e.slug = p_slug
    AND (filter_count = 0 OR (
        SELECT COUNT(*)
        FROM jsonb_each_text(p_filters) f
        WHERE f.key != 'trait_count'
        AND
            CASE
                WHEN f.value = 'none' THEN
                    NOT EXISTS (
                        SELECT 1
                        FROM jsonb_each_text(a.values) attr
                        WHERE attr.key = f.key
                    )
                WHEN f.value LIKE '%-%' AND f.value ~ '^[0-9]+-[0-9]+$' THEN
                    -- Handle numeric range (e.g., "3-7") - NEW FUNCTIONALITY
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'number' THEN
                            (a.values ->> f.key)::INTEGER BETWEEN
                                split_part(f.value, '-', 1)::INTEGER AND
                                split_part(f.value, '-', 2)::INTEGER
                        WHEN 'string' THEN
                            CASE
                                WHEN a.values ->> f.key ~ '^[0-9]+$' THEN
                                    (a.values ->> f.key)::INTEGER BETWEEN
                                        split_part(f.value, '-', 1)::INTEGER AND
                                        split_part(f.value, '-', 2)::INTEGER
                                ELSE
                                    a.values ->> f.key = f.value  -- fallback to exact match
                            END
                        ELSE
                            false  -- no match for non-numeric types
                    END
                ELSE
                    -- Original exact match logic (backwards compatible)
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'array' THEN
                            f.value IN (
                                SELECT jsonb_array_elements_text(a.values -> f.key)
                            )
                        ELSE
                            a.values ->> f.key = f.value
                    END
            END
    ) = filter_count)
    AND (
        NOT has_trait_count_filter OR
        CASE
            WHEN trait_count_filter LIKE '%-%' AND trait_count_filter ~ '^[0-9]+-[0-9]+$' THEN
                -- Handle trait count range (e.g., "3-7") - NEW FUNCTIONALITY
                (
                    SELECT COUNT(*)
                    FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                    WHERE k <> ALL(collection_trait_exclusions)
                ) BETWEEN
                    split_part(trait_count_filter, '-', 1)::INTEGER AND
                    split_part(trait_count_filter, '-', 2)::INTEGER
            ELSE
                -- Original exact match logic (backwards compatible)
                (
                    SELECT COUNT(*)
                    FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                    WHERE k <> ALL(collection_trait_exclusions)
                ) = trait_count_filter::INTEGER
        END
    );

    -- Then, fetch the paginated data with listing information
    SELECT
        jsonb_build_object(
            'data', COALESCE(jsonb_agg(t.*), '[]'::jsonb),
            'total_count', total_count
        )
    INTO result_json
    FROM (
        SELECT
            e."tokenId",
            e.slug,
            e."hashId",
            e.sha,
            CASE
                WHEN l."hashId" IS NOT NULL THEN
                    jsonb_build_object(
                        'listed', l.listed,
                        'toAddress', l."toAddress",
                        'minValue', l."minValue",
                        'listedBy', l."listedBy",
                        'txHash', l."txHash",
                        'l2', l.l2,
                        'createdAt', l."createdAt"
                    )
                ELSE NULL
            END as listing
        FROM ethscriptions e
        LEFT JOIN attributes_new a ON e.sha = a.sha
        LEFT JOIN listings l ON e."hashId" = l."hashId"
        WHERE e.slug = p_slug
        AND (filter_count = 0 OR (
            SELECT COUNT(*)
            FROM jsonb_each_text(p_filters) f
            WHERE f.key != 'trait_count'
            AND
                CASE
                    WHEN f.value = 'none' THEN
                        NOT EXISTS (
                            SELECT 1
                            FROM jsonb_each_text(a.values) attr
                            WHERE attr.key = f.key
                        )
                    WHEN f.value LIKE '%-%' AND f.value ~ '^[0-9]+-[0-9]+$' THEN
                        -- Handle numeric range (e.g., "3-7") - NEW FUNCTIONALITY
                        CASE jsonb_typeof(a.values -> f.key)
                            WHEN 'number' THEN
                                (a.values ->> f.key)::INTEGER BETWEEN
                                    split_part(f.value, '-', 1)::INTEGER AND
                                    split_part(f.value, '-', 2)::INTEGER
                            WHEN 'string' THEN
                                CASE
                                    WHEN a.values ->> f.key ~ '^[0-9]+$' THEN
                                        (a.values ->> f.key)::INTEGER BETWEEN
                                            split_part(f.value, '-', 1)::INTEGER AND
                                            split_part(f.value, '-', 2)::INTEGER
                                    ELSE
                                        a.values ->> f.key = f.value  -- fallback to exact match
                                END
                            ELSE
                                false  -- no match for non-numeric types
                        END
                    ELSE
                        -- Original exact match logic (backwards compatible)
                        CASE jsonb_typeof(a.values -> f.key)
                            WHEN 'array' THEN
                                f.value IN (
                                    SELECT jsonb_array_elements_text(a.values -> f.key)
                                )
                            ELSE
                                a.values ->> f.key = f.value
                        END
                END
        ) = filter_count)
        AND (
            NOT has_trait_count_filter OR
            CASE
                WHEN trait_count_filter LIKE '%-%' AND trait_count_filter ~ '^[0-9]+-[0-9]+$' THEN
                    -- Handle trait count range (e.g., "3-7") - NEW FUNCTIONALITY
                    (
                        SELECT COUNT(*)
                        FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                        WHERE k <> ALL(collection_trait_exclusions)
                    ) BETWEEN
                        split_part(trait_count_filter, '-', 1)::INTEGER AND
                        split_part(trait_count_filter, '-', 2)::INTEGER
                ELSE
                    -- Original exact match logic (backwards compatible)
                    (
                        SELECT COUNT(*)
                        FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                        WHERE k <> ALL(collection_trait_exclusions)
                    ) = trait_count_filter::INTEGER
            END
        )
        ORDER BY
            CASE
                WHEN p_sort_by = 'price-low' THEN COALESCE(l."minValue"::numeric, 999999999999)
                WHEN p_sort_by = 'price-high' THEN -COALESCE(l."minValue"::numeric, -1)
                WHEN p_sort_by = 'rank-low' THEN -COALESCE((a.values ->> 'Rank')::numeric, -1)
                WHEN p_sort_by = 'rank-high' THEN COALESCE((a.values ->> 'Rank')::numeric, 999999)
                WHEN p_sort_by = 'recently-listed' THEN -EXTRACT(EPOCH FROM COALESCE(l."createdAt", '1970-01-01'::timestamp))
                ELSE e."tokenId"::numeric
            END,
            e."tokenId" -- Secondary sort for consistency
        LIMIT p_to_num - p_from_num + 1
        OFFSET p_from_num
    ) t;

    RETURN result_json;
END;
$$;

-- Update the Sepolia network function
CREATE OR REPLACE FUNCTION fetch_all_with_pagination_new_sepolia(
    p_slug text,
    p_from_num integer,
    p_to_num integer,
    p_filters jsonb DEFAULT '{}'::jsonb,
    p_sort_by text DEFAULT 'id'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result_json JSONB;
    total_count INTEGER;
    filter_count INTEGER;
    trait_count_filter TEXT;
    has_trait_count_filter BOOLEAN;
    collection_trait_exclusions TEXT[];
BEGIN
    -- Get collection-specific trait count exclusions
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(c."ignoredTraitFiltersForCounts")
    )
    INTO collection_trait_exclusions
    FROM collections_sepolia c
    WHERE c.slug = p_slug;

    -- Check if trait_count filter is present
    SELECT p_filters ->> 'trait_count' INTO trait_count_filter;
    has_trait_count_filter := trait_count_filter IS NOT NULL;

    -- Calculate the number of attribute filters (excluding trait_count)
    SELECT COUNT(*)
    INTO filter_count
    FROM jsonb_each_text(p_filters)
    WHERE key != 'trait_count';

    -- First, calculate the total count with filters applied
    SELECT COUNT(*)
    INTO total_count
    FROM ethscriptions_sepolia e
    LEFT JOIN attributes_new a ON e.sha = a.sha
    WHERE e.slug = p_slug
    AND (filter_count = 0 OR (
        SELECT COUNT(*)
        FROM jsonb_each_text(p_filters) f
        WHERE f.key != 'trait_count'
        AND
            CASE
                WHEN f.value = 'none' THEN
                    NOT EXISTS (
                        SELECT 1
                        FROM jsonb_each_text(a.values) attr
                        WHERE attr.key = f.key
                    )
                WHEN f.value LIKE '%-%' AND f.value ~ '^[0-9]+-[0-9]+$' THEN
                    -- Handle numeric range (e.g., "3-7") - NEW FUNCTIONALITY
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'number' THEN
                            (a.values ->> f.key)::INTEGER BETWEEN
                                split_part(f.value, '-', 1)::INTEGER AND
                                split_part(f.value, '-', 2)::INTEGER
                        WHEN 'string' THEN
                            CASE
                                WHEN a.values ->> f.key ~ '^[0-9]+$' THEN
                                    (a.values ->> f.key)::INTEGER BETWEEN
                                        split_part(f.value, '-', 1)::INTEGER AND
                                        split_part(f.value, '-', 2)::INTEGER
                                ELSE
                                    a.values ->> f.key = f.value  -- fallback to exact match
                            END
                        ELSE
                            false  -- no match for non-numeric types
                    END
                ELSE
                    -- Original exact match logic (backwards compatible)
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'array' THEN
                            f.value IN (
                                SELECT jsonb_array_elements_text(a.values -> f.key)
                            )
                        ELSE
                            a.values ->> f.key = f.value
                    END
            END
    ) = filter_count)
    AND (
        NOT has_trait_count_filter OR
        CASE
            WHEN trait_count_filter LIKE '%-%' AND trait_count_filter ~ '^[0-9]+-[0-9]+$' THEN
                -- Handle trait count range (e.g., "3-7") - NEW FUNCTIONALITY
                (
                    SELECT COUNT(*)
                    FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                    WHERE k <> ALL(collection_trait_exclusions)
                ) BETWEEN
                    split_part(trait_count_filter, '-', 1)::INTEGER AND
                    split_part(trait_count_filter, '-', 2)::INTEGER
            ELSE
                -- Original exact match logic (backwards compatible)
                (
                    SELECT COUNT(*)
                    FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                    WHERE k <> ALL(collection_trait_exclusions)
                ) = trait_count_filter::INTEGER
        END
    );

    -- Then, fetch the paginated data with listing information
    SELECT
        jsonb_build_object(
            'data', COALESCE(jsonb_agg(t.*), '[]'::jsonb),
            'total_count', total_count
        )
    INTO result_json
    FROM (
        SELECT
            e."tokenId",
            e.slug,
            e."hashId",
            e.sha,
            CASE
                WHEN l."hashId" IS NOT NULL THEN
                    jsonb_build_object(
                        'listed', l.listed,
                        'toAddress', l."toAddress",
                        'minValue', l."minValue",
                        'listedBy', l."listedBy",
                        'txHash', l."txHash",
                        'l2', l.l2,
                        'createdAt', l."createdAt"
                    )
                ELSE NULL
            END as listing
        FROM ethscriptions_sepolia e
        LEFT JOIN attributes_new a ON e.sha = a.sha
        LEFT JOIN listings_sepolia l ON e."hashId" = l."hashId"
        WHERE e.slug = p_slug
        AND (filter_count = 0 OR (
            SELECT COUNT(*)
            FROM jsonb_each_text(p_filters) f
            WHERE f.key != 'trait_count'
            AND
                CASE
                    WHEN f.value = 'none' THEN
                        NOT EXISTS (
                            SELECT 1
                            FROM jsonb_each_text(a.values) attr
                            WHERE attr.key = f.key
                        )
                    WHEN f.value LIKE '%-%' AND f.value ~ '^[0-9]+-[0-9]+$' THEN
                        -- Handle numeric range (e.g., "3-7") - NEW FUNCTIONALITY
                        CASE jsonb_typeof(a.values -> f.key)
                            WHEN 'number' THEN
                                (a.values ->> f.key)::INTEGER BETWEEN
                                    split_part(f.value, '-', 1)::INTEGER AND
                                    split_part(f.value, '-', 2)::INTEGER
                            WHEN 'string' THEN
                                CASE
                                    WHEN a.values ->> f.key ~ '^[0-9]+$' THEN
                                        (a.values ->> f.key)::INTEGER BETWEEN
                                            split_part(f.value, '-', 1)::INTEGER AND
                                            split_part(f.value, '-', 2)::INTEGER
                                    ELSE
                                        a.values ->> f.key = f.value  -- fallback to exact match
                                END
                            ELSE
                                false  -- no match for non-numeric types
                        END
                    ELSE
                        -- Original exact match logic (backwards compatible)
                        CASE jsonb_typeof(a.values -> f.key)
                            WHEN 'array' THEN
                                f.value IN (
                                    SELECT jsonb_array_elements_text(a.values -> f.key)
                                )
                            ELSE
                                a.values ->> f.key = f.value
                        END
                END
        ) = filter_count)
        AND (
            NOT has_trait_count_filter OR
            CASE
                WHEN trait_count_filter LIKE '%-%' AND trait_count_filter ~ '^[0-9]+-[0-9]+$' THEN
                    -- Handle trait count range (e.g., "3-7") - NEW FUNCTIONALITY
                    (
                        SELECT COUNT(*)
                        FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                        WHERE k <> ALL(collection_trait_exclusions)
                    ) BETWEEN
                        split_part(trait_count_filter, '-', 1)::INTEGER AND
                        split_part(trait_count_filter, '-', 2)::INTEGER
                ELSE
                    -- Original exact match logic (backwards compatible)
                    (
                        SELECT COUNT(*)
                        FROM jsonb_object_keys(COALESCE(a.values, '{}'::jsonb)) k
                        WHERE k <> ALL(collection_trait_exclusions)
                    ) = trait_count_filter::INTEGER
            END
        )
        ORDER BY
            CASE
                WHEN p_sort_by = 'price-low' THEN COALESCE(l."minValue"::numeric, 999999999999)
                WHEN p_sort_by = 'price-high' THEN -COALESCE(l."minValue"::numeric, -1)
                WHEN p_sort_by = 'rank-low' THEN -COALESCE((a.values ->> 'Rank')::numeric, -1)
                WHEN p_sort_by = 'rank-high' THEN COALESCE((a.values ->> 'Rank')::numeric, 999999)
                WHEN p_sort_by = 'recently-listed' THEN -EXTRACT(EPOCH FROM COALESCE(l."createdAt", '1970-01-01'::timestamp))
                ELSE e."tokenId"::numeric
            END,
            e."tokenId" -- Secondary sort for consistency
        LIMIT p_to_num - p_from_num + 1
        OFFSET p_from_num
    ) t;

    RETURN result_json;
END;
$$;

-- Add a comment to document the new functionality
COMMENT ON FUNCTION fetch_all_with_pagination_new(text, integer, integer, jsonb, text) IS
'Updated function with backwards-compatible range filter support and collection-specific trait count exclusions. Supports both exact matches (e.g., "5") and ranges (e.g., "3-7") for numeric attributes. Uses collection-specific trait count exclusions from the collections table. The p_sort_by parameter supports: "id", "price-low", "price-high", "rank-low", "rank-high", "recently-listed" (defaults to "id").';

COMMENT ON FUNCTION fetch_all_with_pagination_new_sepolia(text, integer, integer, jsonb, text) IS
'Updated Sepolia function with backwards-compatible range filter support and collection-specific trait count exclusions. Supports both exact matches (e.g., "5") and ranges (e.g., "3-7") for numeric attributes including trait_count. Uses collection-specific trait count exclusions from the collections_sepolia table. The p_sort_by parameter supports: "id", "price-low", "price-high", "rank-low", "rank-high", "recently-listed" (defaults to "id").';
