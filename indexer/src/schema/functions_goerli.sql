--|---------------------------------------------------------------------------------|--
--|-- FETCH COLLECTIONS WITH PREVIEWS ----------------------------------------------|--
--|---------------------------------------------------------------------------------|--

CREATE OR REPLACE FUNCTION fetch_collections_with_previews_goerli(
    preview_limit INT DEFAULT 25
)
RETURNS TABLE(ethscription JSON) AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'slug', c.slug,
        'name', c.name,
        'image', c.image,
        'previews', json_agg(json_build_object(
            'hashId', e."hashId",
            'tokenId', e."tokenId",
            'slug', c.slug,
            'sha', e.sha
        )) FILTER (WHERE e."hashId" IS NOT NULL)
    )
    FROM public.collections_goerli c
    LEFT JOIN LATERAL (
        SELECT e."hashId", e."tokenId"
        FROM public.ethscriptions_goerli e
        WHERE e.slug = c.slug
        ORDER BY e."createdAt" DESC
        LIMIT preview_limit
    ) e ON true
    WHERE
        (c.active = TRUE)
    GROUP BY c.slug, c.name, c.image;
END;
$$ LANGUAGE plpgsql;

--|---------------------------------------------------------------------------------|--
--|-- FETCH OWNED ETHSCRIPTIONS WITH LISTINGS & BIDS -------------------------------|--
--|---------------------------------------------------------------------------------|--

CREATE OR REPLACE FUNCTION fetch_ethscriptions_owned_with_listings_and_bids_goerli(
  address TEXT,
  collection_slug text DEFAULT 'ethereum-phunks'
)
RETURNS TABLE(ethscription JSON) AS $$
DECLARE
    "marketAddress" CONSTANT TEXT := '0x6f67a6f9a1d334cd105170bcd685c518d5610601';  -- market address
    "auctionAddress" CONSTANT TEXT := '0xc6a824d8cce7c946a3f35879694b9261a36fc823'; -- auction address
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'phunk', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'owner', p.owner,
            'prevOwner', p."prevOwner",
            'slug', p.slug
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue"
        ))) FILTER (WHERE l."hashId" IS NOT NULL),
        'bid', json_agg(json_strip_nulls(json_build_object(
            'createdAt', b."createdAt",
            'value', b.value
        ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions_goerli p
    LEFT JOIN public.listings_goerli l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids_goerli b ON p."hashId" = b."hashId"
    WHERE (p.owner = address OR (p.owner = "marketAddress" AND p."prevOwner" = address))
          AND p."slug" = collection_slug
    GROUP BY p."hashId";
END;
$$ LANGUAGE plpgsql;

--|---------------------------------------------------------------------------------|--
--|-- FETCH ALL ETHSCRIPTIONS WITH LISTINGS & BIDS ---------------------------------|--
--|---------------------------------------------------------------------------------|--

CREATE OR REPLACE FUNCTION fetch_ethscriptions_with_listings_and_bids_goerli(
  collection_slug text DEFAULT 'ethereum-phunks'
)
RETURNS TABLE(ethscription JSON) AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'ethscription', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'slug', p."slug"
        )),
        'listing', json_agg(json_strip_nulls(json_build_object(
            'createdAt', l."createdAt",
            'minValue', l."minValue"
        ))) FILTER (WHERE l."hashId" IS NOT NULL),
        'bid', json_agg(json_strip_nulls(json_build_object(
            'createdAt', b."createdAt",
            'value', b.value,
            'fromAddress', b."fromAddress"
        ))) FILTER (WHERE b."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions_goerli p
    LEFT JOIN public.listings_goerli l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids_goerli b ON p."hashId" = b."hashId"
    WHERE
        p."slug" = collection_slug
        AND (EXISTS (SELECT 1 FROM public.listings_goerli l2 WHERE l2."hashId" = p."hashId" AND l2."toAddress" = '0x0000000000000000000000000000000000000000')
             OR EXISTS (SELECT 1 FROM public.bids_goerli b2 WHERE b2."hashId" = p."hashId"))
    GROUP BY p."hashId";
END;
$$ LANGUAGE plpgsql;


--|---------------------------------------------------------------------------------|--
--|-- FETCH EVENTS -----------------------------------------------------------------|--
--|---------------------------------------------------------------------------------|--

CREATE OR REPLACE FUNCTION fetch_events_goerli(
    p_limit INT,
    p_type TEXT DEFAULT NULL,
    p_collection_slug TEXT DEFAULT 'ethereum-phunks'
)
RETURNS TABLE (
    "hashId" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "tokenId" BIGINT,
    "blockTimestamp" TIMESTAMP WITH TIME ZONE,
    type TEXT,
    value TEXT,
    slug TEXT,
    sha TEXT
) AS $$
DECLARE
    "marketAddress" CONSTANT TEXT := '0x6f67a6f9a1d334cd105170bcd685c518d5610601';  -- market address
    "auctionAddress" CONSTANT TEXT := '0xc6a824d8cce7c946a3f35879694b9261a36fc823'; -- auction address
BEGIN
    RETURN QUERY EXECUTE
    'SELECT
        e."hashId",
        e."from",
        e."to",
        eg."tokenId",
        e."blockTimestamp",
        e.type,
        e.value,
        eg.slug,
        eg.sha
    FROM
        public.events_goerli e
    INNER JOIN public.ethscriptions_goerli eg ON e."hashId" = eg."hashId"
    WHERE
        eg."slug" = ''' || p_collection_slug || '''
        AND e."to" != ''' || "auctionAddress" || '''
        AND e."to" != ''' || "marketAddress" || '''
        AND e."from" != ''' || "auctionAddress" || '''
        AND e.type != ''PhunkNoLongerForSale''' ||
        (CASE WHEN p_type IS NOT NULL THEN
            ' AND e.type = ''' || p_type || ''''
        ELSE
            ''
        END) ||
    ' ORDER BY e."blockTimestamp" DESC
    LIMIT ' || p_limit;
END;
$$ LANGUAGE plpgsql;

--|---------------------------------------------------------------------------------|--
--|-- FETCH LEADERBOARD ------------------------------------------------------------|--
--|---------------------------------------------------------------------------------|--

CREATE OR REPLACE FUNCTION fetch_leaderboard_goerli()
RETURNS TABLE (
    address text,
    points bigint,
    sales bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.address,
        u.points,
        -- other columns from users
        COUNT(e.from) as sales
    FROM
        users_goerli u
    LEFT JOIN
        events_goerli e ON u.address = e.from AND e.type = 'PhunkBought'
    GROUP BY
        u.address
    ORDER BY
        u.points DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;
