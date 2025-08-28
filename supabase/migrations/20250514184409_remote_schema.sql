

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "goerli";


ALTER SCHEMA "goerli" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."addresses_are_holders"("addresses" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  market_address text := '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT
        CASE
          WHEN es.owner = market_address THEN es."prevOwner"
          ELSE es.owner
        END AS effective_owner,
        es."tokenId",
        es."hashId",
        es.sha,
        es.owner,
        es."prevOwner",
        es."createdAt"
      FROM ethscriptions es
      WHERE (es.owner = ANY(addresses) AND es.owner <> market_address)
         OR (es."prevOwner" = ANY(addresses) AND es.owner = market_address)
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY effective_owner ORDER BY "createdAt" ASC) as rn
      FROM filtered
    )
    SELECT jsonb_agg(jsonb_build_object(
      'address', effective_owner,
      'item', jsonb_build_object(
        'tokenId', "tokenId",
        'hashId', "hashId",
        'sha', sha,
        'owner', owner,
        'prevOwner', "prevOwner"
      )
    ))
    FROM ranked
    WHERE rn = 1
  );
END;
$$;


ALTER FUNCTION "public"."addresses_are_holders"("addresses" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."addresses_are_holders_sepolia"("addresses" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  market_address text := '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e';
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT
        CASE
          WHEN es.owner = market_address THEN es."prevOwner"
          ELSE es.owner
        END AS effective_owner,
        es."tokenId",
        es."hashId",
        es.sha,
        es.owner,
        es."prevOwner",
        es."createdAt"
      FROM ethscriptions_sepolia es
      WHERE (es.owner = ANY(addresses) AND es.owner <> market_address)
         OR (es."prevOwner" = ANY(addresses) AND es.owner = market_address)
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY effective_owner ORDER BY "createdAt" ASC) as rn
      FROM filtered
    )
    SELECT jsonb_agg(jsonb_build_object(
      'address', effective_owner,
      'item', jsonb_build_object(
        'tokenId', "tokenId",
        'hashId', "hashId",
        'sha', sha,
        'owner', owner,
        'prevOwner', "prevOwner"
      )
    ))
    FROM ranked
    WHERE rn = 1
  );
END;
$$;


ALTER FUNCTION "public"."addresses_are_holders_sepolia"("addresses" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_all_with_pagination_new"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    result_json JSONB;
    total_count INTEGER;
    filter_count INTEGER;
BEGIN
    -- Calculate the number of filters
    SELECT COUNT(*)
    INTO filter_count
    FROM jsonb_each_text(p_filters);

    -- First, calculate the total count with filters applied
    SELECT COUNT(*)
    INTO total_count
    FROM ethscriptions e
    LEFT JOIN attributes_new a ON e.sha = a.sha
    WHERE e.slug = p_slug
    AND (filter_count = 0 OR (
        SELECT COUNT(*)
        FROM jsonb_each_text(p_filters) f
        WHERE
            CASE
                WHEN f.value = 'none' THEN
                    NOT EXISTS (
                        SELECT 1
                        FROM jsonb_each_text(a.values) attr
                        WHERE attr.key = f.key
                    )
                ELSE
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'array' THEN
                            f.value IN (
                                SELECT jsonb_array_elements_text(a.values -> f.key)
                            )
                        ELSE
                            a.values ->> f.key = f.value
                    END
            END
    ) = filter_count);

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
            WHERE
                CASE
                    WHEN f.value = 'none' THEN
                        NOT EXISTS (
                            SELECT 1
                            FROM jsonb_each_text(a.values) attr
                            WHERE attr.key = f.key
                        )
                    ELSE
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
        ORDER BY e."tokenId"
        LIMIT p_to_num - p_from_num + 1
        OFFSET p_from_num
    ) t;

    RETURN result_json;
END;$$;


ALTER FUNCTION "public"."fetch_all_with_pagination_new"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_all_with_pagination_new_sepolia"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
    result_json JSONB;
    total_count INTEGER;
    filter_count INTEGER;
BEGIN
    -- Calculate the number of filters
    SELECT COUNT(*)
    INTO filter_count
    FROM jsonb_each_text(p_filters);

    -- First, calculate the total count with filters applied
    SELECT COUNT(*)
    INTO total_count
    FROM ethscriptions_sepolia e
    LEFT JOIN attributes_new a ON e.sha = a.sha
    WHERE e.slug = p_slug
    AND (filter_count = 0 OR (
        SELECT COUNT(*)
        FROM jsonb_each_text(p_filters) f
        WHERE
            CASE
                WHEN f.value = 'none' THEN
                    NOT EXISTS (
                        SELECT 1
                        FROM jsonb_each_text(a.values) attr
                        WHERE attr.key = f.key
                    )
                ELSE
                    CASE jsonb_typeof(a.values -> f.key)
                        WHEN 'array' THEN
                            f.value IN (
                                SELECT jsonb_array_elements_text(a.values -> f.key)
                            )
                        ELSE
                            a.values ->> f.key = f.value
                    END
            END
    ) = filter_count);

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
            WHERE
                CASE
                    WHEN f.value = 'none' THEN
                        NOT EXISTS (
                            SELECT 1
                            FROM jsonb_each_text(a.values) attr
                            WHERE attr.key = f.key
                        )
                    ELSE
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
        ORDER BY e."tokenId"
        LIMIT p_to_num - p_from_num + 1
        OFFSET p_from_num
    ) t;

    RETURN result_json;
END;$$;


ALTER FUNCTION "public"."fetch_all_with_pagination_new_sepolia"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer DEFAULT 25, "show_inactive" boolean DEFAULT false) RETURNS TABLE("ethscription" "json")
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
        (show_inactive = TRUE OR c.active = TRUE)
    GROUP BY c.slug, c.name, c.image;
END;$$;


ALTER FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer, "show_inactive" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer DEFAULT 25, "show_inactive" boolean DEFAULT false) RETURNS TABLE("ethscription" "json")
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
        c.active = (NOT show_inactive)
    GROUP BY c.slug, c.name, c.image;
END;$$;


ALTER FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer, "show_inactive" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_comments_recursive_sepolia"("p_root_topic" "text") RETURNS TABLE("createdAt" timestamp with time zone, "content" "text", "topic" "text", "version" "text", "encoding" "text", "topicType" "text", "id" "text", "from" "text", "deleted" boolean, "type" "text", "level" integer, "path" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        -- Base case: get root level comments
        SELECT 
            c."createdAt",
            c.content,
            c.topic,
            c.version,
            c.encoding,
            c."topicType",
            c.id,
            c."from",
            c.deleted,
            c.type,
            1 as level,
            ARRAY[c.id] as path
        FROM comments_sepolia c
        WHERE LOWER(c.topic) = LOWER(p_root_topic)
        
        UNION ALL
        
        -- Recursive case: get replies
        SELECT 
            c."createdAt",
            c.content,
            c.topic,
            c.version,
            c.encoding,
            c."topicType",
            c.id,
            c."from",
            c.deleted,
            c.type,
            ct.level + 1,
            ct.path || c.id
        FROM comments_sepolia c
        INNER JOIN comment_tree ct ON LOWER(c.topic) = LOWER(ct.id)
    )
    SELECT *
    FROM comment_tree
    ORDER BY path, "createdAt" DESC;
END;
$$;


ALTER FUNCTION "public"."fetch_comments_recursive_sepolia"("p_root_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids"("address" "text", "collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("ethscription" "json")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    "marketAddress" CONSTANT TEXT := '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';  -- market address
    "auctionAddress" CONSTANT TEXT := ''; -- auction address
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'phunk', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'owner', p.owner,
            'prevOwner', p."prevOwner",
            'slug', p.slug,
            'sha', p.sha
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue"
        ))) FILTER (WHERE l."hashId" IS NOT NULL)
        -- ,
        -- 'bid', json_agg(json_strip_nulls(json_build_object(
        --     'createdAt', b."createdAt",
        --     'value', b.value
        -- ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions p
    LEFT JOIN public.listings l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids b ON p."hashId" = b."hashId"
    WHERE (p.owner = address OR (p.owner = "marketAddress" AND p."prevOwner" = address))
          AND p."slug" = collection_slug
    GROUP BY p."hashId", p."tokenId", p.owner, p."prevOwner", p.slug, p.sha;
END;
$$;


ALTER FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids"("address" "text", "collection_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids_sepolia"("address" "text", "collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("ethscription" "json")
    LANGUAGE "plpgsql"
    AS $$DECLARE
    "marketAddress" CONSTANT TEXT := '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e';  -- market address
    "auctionAddress" CONSTANT TEXT := ''; -- auction address
    "bridgeAddressMainnet" CONSTANT TEXT := '0x1565f60d2469f18bbcc96b2c29220412f2fe98bd'; -- bridge address
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'phunk', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'owner', p.owner,
            'prevOwner', p."prevOwner",
            'slug', p.slug,
            'sha', p.sha
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue"
        ))) FILTER (WHERE l."hashId" IS NOT NULL)
        -- ,
        -- 'bid', json_agg(json_strip_nulls(json_build_object(
        --     'createdAt', b."createdAt",
        --     'value', b.value
        -- ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions_sepolia p
    LEFT JOIN public.listings_sepolia l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids_sepolia b ON p."hashId" = b."hashId"
    WHERE (
      p.owner = address 
      OR (
        p.owner = "marketAddress" 
        AND p."prevOwner" = address
      )
      OR (
        p.owner = "bridgeAddressMainnet" 
        AND p."prevOwner" = address
      )
    )
    AND p."slug" = collection_slug
    GROUP BY p."hashId", p."tokenId", p.owner, p."prevOwner", p.slug, p.sha;
END;$$;


ALTER FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids_sepolia"("address" "text", "collection_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("ethscription" "json")
    LANGUAGE "plpgsql"
    AS $$BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'ethscription', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'slug', p.slug,
            'sha', p.sha,
            'owner', p.owner,
            'prevOwner', p."prevOwner"
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue"
        ))) FILTER (WHERE l."hashId" IS NOT NULL)
        -- ,
        -- 'bid', json_agg(json_strip_nulls(json_build_object(
        --     'createdAt', b."createdAt",
        --     'value', b.value,
        --     'fromAddress', b."fromAddress"
        -- ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions p
    LEFT JOIN public.listings l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids b ON p."hashId" = b."hashId"
    WHERE
        p."slug" = collection_slug
        AND (EXISTS (SELECT 1 FROM public.listings l2 WHERE l2."hashId" = p."hashId" AND l2."toAddress" = '0x0000000000000000000000000000000000000000')
             OR EXISTS (SELECT 1 FROM public.bids b2 WHERE b2."hashId" = p."hashId"))
    GROUP BY p."hashId", p."tokenId", p.slug, p.sha, p.owner, p."prevOwner";
END;$$;


ALTER FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("ethscription" "json")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'ethscription', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'slug', p."slug",
            'sha', p.sha,
            'owner', p.owner,
            'prevOwner', p."prevOwner"
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue",
            'listedBy', l."listedBy"
        ))) FILTER (WHERE l."hashId" IS NOT NULL),
        'bid', json_agg(json_strip_nulls(json_build_object(
            'createdAt', b."createdAt",
            'value', b.value,
            'fromAddress', b."fromAddress"
        ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions_sepolia p
    LEFT JOIN public.listings_sepolia l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids_sepolia b ON p."hashId" = b."hashId"
    WHERE
        p."slug" = collection_slug
        AND (EXISTS (SELECT 1 FROM public.listings_sepolia l2 WHERE l2."hashId" = p."hashId" AND l2."toAddress" = '0x0000000000000000000000000000000000000000')
             OR EXISTS (SELECT 1 FROM public.bids_sepolia b2 WHERE b2."hashId" = p."hashId"))
    GROUP BY p."hashId";
END;
$$;


ALTER FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("collection_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_events"("p_limit" integer, "p_type" "text" DEFAULT NULL::"text", "p_collection_slug" "text" DEFAULT 'ethereum-phunks'::"text", "p_offset" integer DEFAULT 0) RETURNS TABLE("hashId" "text", "from" "text", "to" "text", "tokenId" bigint, "blockTimestamp" timestamp with time zone, "type" "text", "value" "text", "slug" "text", "sha" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
    "marketAddress" CONSTANT TEXT := '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';  -- market address
    "auctionAddress" CONSTANT TEXT := ''; -- auction address
BEGIN
    RETURN QUERY EXECUTE
    'SELECT
        e."hashId",
        e.from,
        e.to,
        eg."tokenId",
        e."blockTimestamp",
        e.type,
        e.value,
        eg.slug,
        eg.sha
    FROM
        public.events e
    INNER JOIN public.ethscriptions eg ON e."hashId" = eg."hashId"
    WHERE
        eg.slug = ''' || p_collection_slug || '''
        AND e.to != ''' || "auctionAddress" || '''
        AND e.to != ''' || "marketAddress" || '''
        AND e.from != ''' || "auctionAddress" || '''
        AND e.type != ''PhunkNoLongerForSale''' ||
        (CASE WHEN p_type IS NOT NULL THEN
            ' AND e.type = ''' || p_type || ''''
        ELSE
            ''
        END) ||
    ' ORDER BY e."blockTimestamp" DESC, e."txId" ASC
    LIMIT ' || p_limit || '
    OFFSET ' || p_offset;
END;$$;


ALTER FUNCTION "public"."fetch_events"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_events_sepolia"("p_limit" integer, "p_type" "text" DEFAULT NULL::"text", "p_collection_slug" "text" DEFAULT 'ethereum-phunks'::"text", "p_offset" integer DEFAULT 0) RETURNS TABLE("hashId" "text", "from" "text", "to" "text", "tokenId" bigint, "blockTimestamp" timestamp with time zone, "type" "text", "value" "text", "slug" "text", "sha" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
    "marketAddress" CONSTANT TEXT := '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e';  -- market address
    "auctionAddress" CONSTANT TEXT := '0xc6a824d8cce7c946a3f35879694b9261a36fc823'; -- auction address
BEGIN
    RETURN QUERY EXECUTE
    'SELECT
        e."hashId",
        e.from,
        e.to,
        eg."tokenId",
        e."blockTimestamp",
        e.type,
        e.value,
        eg.slug,
        eg.sha
    FROM
        public.events_sepolia e
    INNER JOIN public.ethscriptions_sepolia eg ON e."hashId" = eg."hashId"
    WHERE
        eg.slug = ''' || p_collection_slug || '''
        AND e.to != ''' || "auctionAddress" || '''
        AND e.to != ''' || "marketAddress" || '''
        AND e.from != ''' || "auctionAddress" || '''
        AND e.type != ''PhunkNoLongerForSale''' ||
        (CASE WHEN p_type IS NOT NULL THEN
            ' AND e.type = ''' || p_type || ''''
        ELSE
            ''
        END) ||
    ' ORDER BY e."blockTimestamp" DESC, e."txId" ASC
    LIMIT ' || p_limit || '
    OFFSET ' || p_offset;
END;$$;


ALTER FUNCTION "public"."fetch_events_sepolia"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_leaderboard"() RETURNS TABLE("address" "text", "points" bigint, "sales" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.address,
        u.points,
        -- other columns from users
        COUNT(e.from) as sales
    FROM
        users u
    LEFT JOIN
        events e ON u.address = e.from AND e.type = 'PhunkBought'
    GROUP BY
        u.address
    ORDER BY
        u.points DESC
    LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."fetch_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_leaderboard_sepolia"() RETURNS TABLE("address" "text", "points" bigint, "sales" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.address,
        u.points,
        -- other columns from users
        COUNT(e.from) as sales
    FROM
        users_sepolia u
    LEFT JOIN
        events_sepolia e ON u.address = e.from AND e.type = 'PhunkBought'
    GROUP BY
        u.address
    ORDER BY
        u.points DESC
    LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."fetch_leaderboard_sepolia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_top_sales"("p_limit" integer DEFAULT 100, "p_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("hashId" "text", "tokenId" bigint, "value" numeric, "from" "text", "to" "text", "blockTimestamp" timestamp with time zone, "txHash" "text", "slug" "text", "type" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e."hashId",
        es."tokenId",
        e."value"::numeric / 1e18 as "value",
        e."from",
        e."to",
        e."blockTimestamp",
        e."txHash",
        es.slug,
        e.type
    FROM 
        public.events e
    INNER JOIN 
        public.ethscriptions es ON e."hashId" = es."hashId"
    WHERE 
        (e.type = 'PhunkBought' OR (e.type = 'transfer' AND e."value"::numeric != 0))
        AND (p_slug IS NULL OR es.slug = p_slug)
    ORDER BY 
        e."value"::numeric DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."fetch_top_sales"("p_limit" integer, "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_user_events_sepolia"("p_limit" integer, "p_address" "text", "p_type" "text" DEFAULT NULL::"text", "p_collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("hashId" "text", "from" "text", "to" "text", "tokenId" bigint, "blockTimestamp" timestamp with time zone, "type" "text", "value" "text", "slug" "text", "sha" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    "marketAddress" CONSTANT TEXT := '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e';  -- market address
BEGIN
    RETURN QUERY EXECUTE
    'WITH corrected_events AS (
        SELECT
            e."hashId",
            CASE
                WHEN e."from" = ''' || "marketAddress" || ''' AND e.type IN (''PhunkBought'', ''escrow'') THEN (
                    SELECT e2."from"
                    FROM public.events_sepolia e2
                    WHERE e2."to" = ''' || "marketAddress" || '''
                    AND e2."hashId" = e."hashId"
                    LIMIT 1
                )
                ELSE e."from"
            END AS "fromAddress",
            e."to" AS "toAddress",
            eg."tokenId",
            e."blockTimestamp",
            e.type,
            e.value,
            eg.slug,
            eg.sha
        FROM
            public.events_sepolia e
        INNER JOIN public.ethscriptions_sepolia eg ON e."hashId" = eg."hashId"
        WHERE
            eg."slug" = ''' || p_collection_slug || '''
            AND (e."to" = ''' || p_address || ''' OR e."from" = ''' || p_address || ''' OR (
                e."from" = ''' || "marketAddress" || ''' AND e.type IN (''PhunkBought'', ''escrow'') AND (
                    SELECT e2."from"
                    FROM public.events_sepolia e2
                    WHERE e2."to" = ''' || "marketAddress" || '''
                    AND e2."hashId" = e."hashId"
                    LIMIT 1
                ) = ''' || p_address || '''
            ))
            AND e."to" != ''' || "marketAddress" || '''
            AND e.type != ''PhunkNoLongerForSale''' ||
            (CASE WHEN p_type IS NOT NULL THEN
                ' AND e.type = ''' || p_type || ''''
            ELSE
                ''
            END) ||
            ' AND NOT (e.type = ''transfer'' AND (e."to" = ''' || p_address || ''' OR e."from" = ''' || p_address || '''))'
    ' ORDER BY e."blockTimestamp" DESC
    LIMIT ' || p_limit
    || ') SELECT * FROM corrected_events;';
END;
$$;


ALTER FUNCTION "public"."fetch_user_events_sepolia"("p_limit" integer, "p_address" "text", "p_type" "text", "p_collection_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_volume"("start_date" timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '30 days'::interval), "end_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "slug_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("volume" numeric, "sales" bigint)
    LANGUAGE "plpgsql"
    AS $$BEGIN
    RETURN QUERY
    SELECT
        -- Sum of "value" column converted from wei to ETH
        COALESCE(SUM(e."value"::numeric / 1e18), 0) AS volume,
        -- Count of sales
        COALESCE(COUNT(*), 0) AS sales
    FROM
        public.events e
    INNER JOIN public.ethscriptions es ON e."hashId" = es."hashId"
    WHERE
        (e.type = 'PhunkBought' OR (e.type = 'transfer' AND e."value"::numeric != 0))
        AND e."blockTimestamp" BETWEEN start_date AND end_date
        AND (slug_filter IS NULL OR es.slug = slug_filter);
END;$$;


ALTER FUNCTION "public"."get_total_volume"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_volume_sepolia"("start_date" timestamp with time zone DEFAULT (CURRENT_TIMESTAMP - '30 days'::interval), "end_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "slug_filter" "text" DEFAULT NULL::"text") RETURNS TABLE("volume" numeric, "sales" bigint)
    LANGUAGE "plpgsql"
    AS $$BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(e."value"::numeric / 1e18), 0) AS volume,
        COALESCE(COUNT(*), 0) AS sales
    FROM
        public.events_sepolia e
    INNER JOIN public.ethscriptions_sepolia es ON e."hashId" = es."hashId"
    WHERE
        e.type = 'PhunkBought'
        AND e."blockTimestamp" BETWEEN start_date AND end_date
        AND (slug_filter IS NULL OR es.slug = slug_filter);
END;$$;


ALTER FUNCTION "public"."get_total_volume_sepolia"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_buy_bans"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    owned_count INTEGER;
    target_address TEXT;
    max_allowed INTEGER := 200;
BEGIN
    -- First determine the target address
    target_address := CASE 
        WHEN NEW.owner = '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e' THEN NEW."prevOwner"
        ELSE NEW.owner 
    END;

    -- Count owned items
    SELECT COUNT(*) INTO owned_count
    FROM ethscriptions_sepolia e
    WHERE (
        -- Direct ownership
        e.owner = target_address
        OR 
        -- Marketplace case
        (e.owner = '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e' AND e."prevOwner" = target_address)
    );

    -- Manage bans
    IF owned_count > max_allowed THEN
        INSERT INTO "buyBans_sepolia" (id)
        VALUES (target_address)
        ON CONFLICT (id) DO NOTHING;
    ELSE
        DELETE FROM "buyBans_sepolia"
        WHERE id = target_address;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."manage_buy_bans"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "embedding" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    (embedding::text)::jsonb as embedding,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_global_config" (
    "maintenance" boolean DEFAULT false NOT NULL,
    "network" bigint DEFAULT '1'::bigint NOT NULL,
    "chat" boolean DEFAULT true NOT NULL,
    "comments" boolean DEFAULT false NOT NULL,
    "defaultCollection" "text" DEFAULT 'ethereum-phunks'::"text" NOT NULL
);


ALTER TABLE "public"."_global_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attributes" (
    "sha" "text" NOT NULL,
    "values" "jsonb",
    "slug" "text",
    "tokenId" bigint
);


ALTER TABLE "public"."attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attributes_new" (
    "sha" "text" NOT NULL,
    "values" "jsonb",
    "slug" "text",
    "tokenId" bigint
);


ALTER TABLE "public"."attributes_new" OWNER TO "postgres";


COMMENT ON TABLE "public"."attributes_new" IS 'This is a duplicate of attributes';



CREATE TABLE IF NOT EXISTS "public"."auctionBids" (
    "id" bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auctionId" bigint NOT NULL,
    "fromAddress" "text" DEFAULT ''::"text" NOT NULL,
    "amount" "text" DEFAULT '0'::"text" NOT NULL,
    "extended" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."auctionBids" OWNER TO "postgres";


ALTER TABLE "public"."auctionBids" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auctionBids_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auctionBids_sepolia" (
    "id" bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auctionId" bigint NOT NULL,
    "fromAddress" "text" DEFAULT ''::"text" NOT NULL,
    "amount" "text" DEFAULT '0'::"text" NOT NULL,
    "extended" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."auctionBids_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."auctionBids_sepolia" IS 'This is a duplicate of auctionBids';



ALTER TABLE "public"."auctionBids_sepolia" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auctionBids_sepolia_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auctions" (
    "auctionId" bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "prevOwner" "text",
    "amount" "text" DEFAULT '0'::"text" NOT NULL,
    "startTime" timestamp with time zone,
    "endTime" timestamp with time zone,
    "bidder" "text",
    "settled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."auctions" OWNER TO "postgres";


ALTER TABLE "public"."auctions" ALTER COLUMN "auctionId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auctions_auctionId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auctions_sepolia" (
    "auctionId" bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "prevOwner" "text",
    "amount" "text" DEFAULT '0'::"text" NOT NULL,
    "startTime" timestamp with time zone,
    "endTime" timestamp with time zone,
    "bidder" "text",
    "settled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."auctions_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."auctions_sepolia" IS 'This is a duplicate of auctions';



ALTER TABLE "public"."auctions_sepolia" ALTER COLUMN "auctionId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auctions_sepolia_auctionId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bids" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "fromAddress" "text" NOT NULL,
    "value" "text" DEFAULT '0'::"text" NOT NULL,
    "txHash" "text" NOT NULL
);


ALTER TABLE "public"."bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bids_sepolia" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "fromAddress" "text" NOT NULL,
    "value" "text" DEFAULT '0'::"text" NOT NULL,
    "txHash" "text" NOT NULL
);


ALTER TABLE "public"."bids_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."bids_sepolia" IS 'This is a duplicate of bids';



CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "network" bigint NOT NULL,
    "blockNumber" bigint DEFAULT '0'::bigint NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


ALTER TABLE "public"."blocks" ALTER COLUMN "network" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."blocks_network_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."buyBans_sepolia" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."buyBans_sepolia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "slug" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posterHashId" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "image" "text",
    "singleName" "text",
    "active" boolean DEFAULT false NOT NULL,
    "supply" bigint DEFAULT '0'::bigint NOT NULL,
    "id" bigint NOT NULL,
    "website" "text",
    "twitter" "text",
    "discord" "text",
    "isMinting" boolean DEFAULT false NOT NULL,
    "hasBackgrounds" boolean DEFAULT false NOT NULL,
    "notifications" boolean DEFAULT false NOT NULL,
    "mintEnabled" boolean DEFAULT false NOT NULL,
    "defaultBackground" "text",
    "standalone" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


ALTER TABLE "public"."collections" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."collections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."collections_sepolia" (
    "slug" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image" "text",
    "singleName" "text",
    "active" boolean DEFAULT false NOT NULL,
    "supply" bigint DEFAULT '0'::bigint NOT NULL,
    "id" bigint NOT NULL,
    "website" "text",
    "twitter" "text",
    "discord" "text",
    "isMinting" boolean DEFAULT false NOT NULL,
    "hasBackgrounds" boolean DEFAULT false NOT NULL,
    "notifications" boolean DEFAULT false NOT NULL,
    "mintEnabled" boolean DEFAULT false NOT NULL,
    "defaultBackground" "text",
    "posterHashId" "text",
    "standalone" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."collections_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."collections_sepolia" IS 'This is a duplicate of collections';



ALTER TABLE "public"."collections_sepolia" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."collections_sepolia_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text",
    "topic" "text" NOT NULL,
    "version" "text" DEFAULT '0.0.1'::"text" NOT NULL,
    "encoding" "text" NOT NULL,
    "topicType" "text",
    "id" "text" NOT NULL,
    "from" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "type" "text" DEFAULT 'comment'::"text" NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."comments" IS 'This is a duplicate of comments_sepolia';



CREATE TABLE IF NOT EXISTS "public"."comments_sepolia" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text",
    "topic" "text" NOT NULL,
    "version" "text" DEFAULT '0.0.1'::"text" NOT NULL,
    "encoding" "text" NOT NULL,
    "topicType" "text",
    "id" "text" NOT NULL,
    "from" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "type" "text" DEFAULT 'comment'::"text" NOT NULL
);


ALTER TABLE "public"."comments_sepolia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connected_accounts" (
    "publicKeys" "jsonb" NOT NULL,
    "id" "text" NOT NULL
);


ALTER TABLE "public"."connected_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ethscriptions" (
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "creator" "text",
    "owner" "text",
    "hashId" "text" NOT NULL,
    "sha" "text" NOT NULL,
    "tokenId" bigint DEFAULT '-1'::bigint NOT NULL,
    "prevOwner" "text",
    "slug" "text",
    "oldHashId" "text",
    "locked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ethscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ethscriptions_sepolia" (
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "creator" "text",
    "owner" "text",
    "hashId" "text" NOT NULL,
    "sha" "text" NOT NULL,
    "tokenId" bigint DEFAULT '-1'::bigint NOT NULL,
    "prevOwner" "text",
    "slug" "text",
    "oldHashId" "text",
    "locked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ethscriptions_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."ethscriptions_sepolia" IS 'This is a duplicate of ethscriptions';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "hashId" "text" NOT NULL,
    "from" "text" NOT NULL,
    "to" "text" NOT NULL,
    "blockHash" "text" NOT NULL,
    "txHash" "text" NOT NULL,
    "blockNumber" bigint,
    "blockTimestamp" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "value" "text",
    "txId" "text" NOT NULL,
    "txIndex" bigint DEFAULT '-1'::bigint NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_sepolia" (
    "hashId" "text" NOT NULL,
    "from" "text" NOT NULL,
    "to" "text" NOT NULL,
    "blockHash" "text" NOT NULL,
    "txHash" "text" NOT NULL,
    "blockNumber" bigint,
    "blockTimestamp" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "value" "text",
    "txId" "text" NOT NULL,
    "txIndex" bigint DEFAULT '-1'::bigint NOT NULL,
    "l2" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."events_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."events_sepolia" IS 'This is a duplicate of events';



CREATE TABLE IF NOT EXISTS "public"."listings" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "listed" boolean DEFAULT false NOT NULL,
    "toAddress" "text",
    "minValue" "text" NOT NULL,
    "listedBy" "text" NOT NULL,
    "txHash" "text" NOT NULL,
    "l2" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings_sepolia" (
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashId" "text" NOT NULL,
    "listed" boolean DEFAULT false NOT NULL,
    "toAddress" "text",
    "minValue" "text" NOT NULL,
    "listedBy" "text" NOT NULL,
    "txHash" "text" NOT NULL,
    "l2" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."listings_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."listings_sepolia" IS 'This is a duplicate of listings';



CREATE TABLE IF NOT EXISTS "public"."nfts" (
    "tokenId" bigint NOT NULL,
    "hashId" "text" NOT NULL,
    "owner" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nfts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nfts_sepolia" (
    "tokenId" bigint NOT NULL,
    "hashId" "text" NOT NULL,
    "owner" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nfts_sepolia" OWNER TO "postgres";


ALTER TABLE "public"."nfts_sepolia" ALTER COLUMN "tokenId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."nfts_sepolia_tokenId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."nfts" ALTER COLUMN "tokenId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."nfts_tokenId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "address" "text" NOT NULL,
    "points" bigint DEFAULT '0'::bigint NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_sepolia" (
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "address" "text" NOT NULL,
    "points" bigint DEFAULT '0'::bigint NOT NULL
);


ALTER TABLE "public"."users_sepolia" OWNER TO "postgres";


COMMENT ON TABLE "public"."users_sepolia" IS 'This is a duplicate of users';



ALTER TABLE ONLY "public"."_global_config"
    ADD CONSTRAINT "admin_network_key" UNIQUE ("network");



ALTER TABLE ONLY "public"."_global_config"
    ADD CONSTRAINT "admin_pkey" PRIMARY KEY ("network");



ALTER TABLE ONLY "public"."attributes_new"
    ADD CONSTRAINT "attributes_new_pkey" PRIMARY KEY ("sha");



ALTER TABLE ONLY "public"."attributes_new"
    ADD CONSTRAINT "attributes_new_sha_key" UNIQUE ("sha");



ALTER TABLE ONLY "public"."attributes"
    ADD CONSTRAINT "attributes_pkey" PRIMARY KEY ("sha");



ALTER TABLE ONLY "public"."attributes"
    ADD CONSTRAINT "attributes_sha_key" UNIQUE ("sha");



ALTER TABLE ONLY "public"."auctionBids"
    ADD CONSTRAINT "auctionBids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auctionBids_sepolia"
    ADD CONSTRAINT "auctionBids_sepolia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "auctions_pkey" PRIMARY KEY ("auctionId");



ALTER TABLE ONLY "public"."auctions_sepolia"
    ADD CONSTRAINT "auctions_sepolia_pkey" PRIMARY KEY ("auctionId");



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."bids_sepolia"
    ADD CONSTRAINT "bids_sepolia_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("network");



ALTER TABLE ONLY "public"."buyBans_sepolia"
    ADD CONSTRAINT "buyBans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."collections_sepolia"
    ADD CONSTRAINT "collections_sepolia_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments_sepolia"
    ADD CONSTRAINT "comments_sepolia_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."comments_sepolia"
    ADD CONSTRAINT "comments_sepolia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_hashId_key" UNIQUE ("hashId");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_oldHashId_key" UNIQUE ("oldHashId");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_hashId_key" UNIQUE ("hashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_oldHashId_key" UNIQUE ("oldHashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_sha_key" UNIQUE ("sha");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_sha_key" UNIQUE ("sha");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("txId");



ALTER TABLE ONLY "public"."events_sepolia"
    ADD CONSTRAINT "events_sepolia_pkey" PRIMARY KEY ("txId");



ALTER TABLE ONLY "public"."events_sepolia"
    ADD CONSTRAINT "events_sepolia_txId_key" UNIQUE ("txId");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_txId_key" UNIQUE ("txId");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."listings_sepolia"
    ADD CONSTRAINT "listings_sepolia_pkey" PRIMARY KEY ("hashId");



ALTER TABLE ONLY "public"."nfts"
    ADD CONSTRAINT "nfts_pkey" PRIMARY KEY ("tokenId", "hashId");



ALTER TABLE ONLY "public"."nfts_sepolia"
    ADD CONSTRAINT "nfts_sepolia_pkey" PRIMARY KEY ("tokenId", "hashId");



ALTER TABLE ONLY "public"."nfts_sepolia"
    ADD CONSTRAINT "nfts_sepolia_tokenId_key" UNIQUE ("tokenId");



ALTER TABLE ONLY "public"."nfts"
    ADD CONSTRAINT "nfts_tokenId_key" UNIQUE ("tokenId");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("address");



ALTER TABLE ONLY "public"."users_sepolia"
    ADD CONSTRAINT "users_sepolia_pkey" PRIMARY KEY ("address");



CREATE INDEX "attributes_new_attributes_idx" ON "public"."attributes_new" USING "gin" ("values");



CREATE INDEX "comments_sepolia_topic_type_idx" ON "public"."comments_sepolia" USING "btree" ("topic", "topicType");



CREATE INDEX "comments_topic_topicType_idx" ON "public"."comments" USING "btree" ("topic", "topicType");



CREATE INDEX "ethscriptions_hashId_idx" ON "public"."ethscriptions" USING "btree" ("hashId");



CREATE INDEX "ethscriptions_sepolia_hashId_idx" ON "public"."ethscriptions_sepolia" USING "btree" ("hashId");



CREATE INDEX "idx_attributes" ON "public"."attributes" USING "gin" ("values");



CREATE OR REPLACE TRIGGER "update_buy_bans" AFTER INSERT OR UPDATE OF "owner", "prevOwner" ON "public"."ethscriptions_sepolia" FOR EACH ROW EXECUTE FUNCTION "public"."manage_buy_bans"();



ALTER TABLE ONLY "public"."_global_config"
    ADD CONSTRAINT "_global_config_defaultCollection_fkey" FOREIGN KEY ("defaultCollection") REFERENCES "public"."collections"("slug");



ALTER TABLE ONLY "public"."_global_config"
    ADD CONSTRAINT "_global_config_defaultCollection_fkey1" FOREIGN KEY ("defaultCollection") REFERENCES "public"."collections_sepolia"("slug");



ALTER TABLE ONLY "public"."auctionBids"
    ADD CONSTRAINT "auctionBids_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "public"."auctions"("auctionId");



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "auctions_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId");



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_sha_fkey" FOREIGN KEY ("sha") REFERENCES "public"."attributes"("sha");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "ethscriptions_sepolia_sha_fkey1" FOREIGN KEY ("sha") REFERENCES "public"."attributes_new"("sha");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_sha_fkey1" FOREIGN KEY ("sha") REFERENCES "public"."attributes_new"("sha");



ALTER TABLE ONLY "public"."ethscriptions"
    ADD CONSTRAINT "ethscriptions_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."collections"("slug");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId") ON UPDATE RESTRICT ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId");



ALTER TABLE ONLY "public"."nfts"
    ADD CONSTRAINT "nfts_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId");



ALTER TABLE ONLY "public"."nfts_sepolia"
    ADD CONSTRAINT "nfts_sepolia_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions_sepolia"("hashId");



ALTER TABLE ONLY "public"."auctionBids_sepolia"
    ADD CONSTRAINT "public_auctionBids_sepolia_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "public"."auctions"("auctionId");



ALTER TABLE ONLY "public"."auctions_sepolia"
    ADD CONSTRAINT "public_auctions_sepolia_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions"("hashId");



ALTER TABLE ONLY "public"."bids_sepolia"
    ADD CONSTRAINT "public_bids_sepolia_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions_sepolia"("hashId");



ALTER TABLE ONLY "public"."ethscriptions_sepolia"
    ADD CONSTRAINT "public_ethscriptions_sepolia_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."collections_sepolia"("slug");



ALTER TABLE ONLY "public"."events_sepolia"
    ADD CONSTRAINT "public_events_sepolia_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions_sepolia"("hashId");



ALTER TABLE ONLY "public"."listings_sepolia"
    ADD CONSTRAINT "public_listings_sepolia_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "public"."ethscriptions_sepolia"("hashId");



CREATE POLICY "Enable read access for all users" ON "public"."_global_config" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."attributes" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."attributes_new" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."auctionBids" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."bids" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."bids_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."blocks" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."buyBans_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."collections" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."collections_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."comments_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."ethscriptions" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."ethscriptions_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."listings" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."listings_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."nfts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."nfts_sepolia" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."users_sepolia" FOR SELECT USING (true);



ALTER TABLE "public"."_global_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attributes_new" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auctionBids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auctionBids_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auctions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auctions_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bids_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buyBans_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connected_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ethscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ethscriptions_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfts_sepolia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_sepolia" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";










ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."_global_config";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auctionBids";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auctionBids_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auctions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auctions_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bids";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bids_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."blocks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."collections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."collections_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ethscriptions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ethscriptions_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."listings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."listings_sepolia";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users_sepolia";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

































































































































































































































GRANT ALL ON FUNCTION "public"."addresses_are_holders"("addresses" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."addresses_are_holders"("addresses" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addresses_are_holders"("addresses" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."addresses_are_holders_sepolia"("addresses" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."addresses_are_holders_sepolia"("addresses" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addresses_are_holders_sepolia"("addresses" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new_sepolia"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new_sepolia"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_all_with_pagination_new_sepolia"("p_slug" "text", "p_from_num" integer, "p_to_num" integer, "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer, "show_inactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer, "show_inactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews"("preview_limit" integer, "show_inactive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer, "show_inactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer, "show_inactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_collections_with_previews_sepolia"("preview_limit" integer, "show_inactive" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_comments_recursive_sepolia"("p_root_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_comments_recursive_sepolia"("p_root_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_comments_recursive_sepolia"("p_root_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids"("address" "text", "collection_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids"("address" "text", "collection_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids"("address" "text", "collection_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids_sepolia"("address" "text", "collection_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids_sepolia"("address" "text", "collection_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_owned_with_listings_and_bids_sepolia"("address" "text", "collection_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("collection_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("collection_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("collection_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_events"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_events"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_events"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_events_sepolia"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_events_sepolia"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_events_sepolia"("p_limit" integer, "p_type" "text", "p_collection_slug" "text", "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_leaderboard_sepolia"() TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_leaderboard_sepolia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_leaderboard_sepolia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_top_sales"("p_limit" integer, "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_top_sales"("p_limit" integer, "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_top_sales"("p_limit" integer, "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_user_events_sepolia"("p_limit" integer, "p_address" "text", "p_type" "text", "p_collection_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_user_events_sepolia"("p_limit" integer, "p_address" "text", "p_type" "text", "p_collection_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_user_events_sepolia"("p_limit" integer, "p_address" "text", "p_type" "text", "p_collection_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_volume"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_volume"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_volume"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_volume_sepolia"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_volume_sepolia"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_volume_sepolia"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "slug_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_buy_bans"() TO "anon";
GRANT ALL ON FUNCTION "public"."manage_buy_bans"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_buy_bans"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";


















GRANT ALL ON TABLE "public"."_global_config" TO "anon";
GRANT ALL ON TABLE "public"."_global_config" TO "authenticated";
GRANT ALL ON TABLE "public"."_global_config" TO "service_role";



GRANT ALL ON TABLE "public"."attributes" TO "anon";
GRANT ALL ON TABLE "public"."attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."attributes" TO "service_role";



GRANT ALL ON TABLE "public"."attributes_new" TO "anon";
GRANT ALL ON TABLE "public"."attributes_new" TO "authenticated";
GRANT ALL ON TABLE "public"."attributes_new" TO "service_role";



GRANT ALL ON TABLE "public"."auctionBids" TO "anon";
GRANT ALL ON TABLE "public"."auctionBids" TO "authenticated";
GRANT ALL ON TABLE "public"."auctionBids" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auctionBids_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auctionBids_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auctionBids_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auctionBids_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."auctionBids_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."auctionBids_sepolia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auctionBids_sepolia_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auctionBids_sepolia_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auctionBids_sepolia_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auctions" TO "anon";
GRANT ALL ON TABLE "public"."auctions" TO "authenticated";
GRANT ALL ON TABLE "public"."auctions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auctions_auctionId_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auctions_auctionId_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auctions_auctionId_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auctions_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."auctions_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."auctions_sepolia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auctions_sepolia_auctionId_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auctions_sepolia_auctionId_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auctions_sepolia_auctionId_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bids" TO "anon";
GRANT ALL ON TABLE "public"."bids" TO "authenticated";
GRANT ALL ON TABLE "public"."bids" TO "service_role";



GRANT ALL ON TABLE "public"."bids_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."bids_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."bids_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."blocks_network_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."blocks_network_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blocks_network_seq" TO "service_role";



GRANT ALL ON TABLE "public"."buyBans_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."buyBans_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."buyBans_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."collections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."collections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."collections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."collections_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."collections_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."collections_sepolia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."collections_sepolia_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."collections_sepolia_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."collections_sepolia_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."comments_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."comments_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."comments_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."connected_accounts" TO "anon";
GRANT ALL ON TABLE "public"."connected_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."connected_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."ethscriptions" TO "anon";
GRANT ALL ON TABLE "public"."ethscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."ethscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."ethscriptions_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."ethscriptions_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."ethscriptions_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."events_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."events_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."listings_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."listings_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."listings_sepolia" TO "service_role";



GRANT ALL ON TABLE "public"."nfts" TO "anon";
GRANT ALL ON TABLE "public"."nfts" TO "authenticated";
GRANT ALL ON TABLE "public"."nfts" TO "service_role";



GRANT ALL ON TABLE "public"."nfts_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."nfts_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."nfts_sepolia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nfts_sepolia_tokenId_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nfts_sepolia_tokenId_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nfts_sepolia_tokenId_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nfts_tokenId_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nfts_tokenId_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nfts_tokenId_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_sepolia" TO "anon";
GRANT ALL ON TABLE "public"."users_sepolia" TO "authenticated";
GRANT ALL ON TABLE "public"."users_sepolia" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
