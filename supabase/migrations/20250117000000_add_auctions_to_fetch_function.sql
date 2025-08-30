-- Add auctions to fetch_ethscriptions_with_listings_and_bids functions
-- Drop existing functions to prevent duplicates
DROP FUNCTION IF EXISTS "public"."fetch_ethscriptions_with_listings_and_bids_sepolia"("text");
DROP FUNCTION IF EXISTS "public"."fetch_ethscriptions_with_listings_and_bids"("text");

-- Create mainnet function
CREATE OR REPLACE FUNCTION "public"."fetch_ethscriptions_with_listings_and_bids"("collection_slug" "text" DEFAULT 'ethereum-phunks'::"text") RETURNS TABLE("ethscription" "json")
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
        ))) FILTER (WHERE b."hashId" IS NOT NULL),
        'auction', json_agg(json_strip_nulls(json_build_object(
            'auctionId', a."auctionId",
            'createdAt', a."createdAt",
            'prevOwner', a."prevOwner",
            'amount', a.amount,
            'startTime', a."startTime",
            'endTime', a."endTime",
            'bidder', a.bidder,
            'settled', a.settled
        ))) FILTER (WHERE a."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions p
    LEFT JOIN public.listings l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids b ON p."hashId" = b."hashId"
    LEFT JOIN public.auctions a ON p."hashId" = a."hashId" AND a."settled" = false
    WHERE
        p."slug" = collection_slug
        AND (EXISTS (SELECT 1 FROM public.listings l2 WHERE l2."hashId" = p."hashId" AND l2."toAddress" = '0x0000000000000000000000000000000000000000')
             OR EXISTS (SELECT 1 FROM public.bids b2 WHERE b2."hashId" = p."hashId")
             OR EXISTS (SELECT 1 FROM public.auctions a2 WHERE a2."hashId" = p."hashId" AND a2."settled" = false))
    GROUP BY p."hashId";
END;
$$;

-- Create Sepolia function
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
        ))) FILTER (WHERE b."hashId" IS NOT NULL),
        'auction', json_agg(json_strip_nulls(json_build_object(
            'auctionId', a."auctionId",
            'createdAt', a."createdAt",
            'prevOwner', a."prevOwner",
            'amount', a.amount,
            'startTime', a."startTime",
            'endTime', a."endTime",
            'bidder', a.bidder,
            'settled', a.settled
        ))) FILTER (WHERE a."hashId" IS NOT NULL)
    )
    FROM public.ethscriptions_sepolia p
    LEFT JOIN public.listings_sepolia l ON p."hashId" = l."hashId" AND l."toAddress" = '0x0000000000000000000000000000000000000000'
    LEFT JOIN public.bids_sepolia b ON p."hashId" = b."hashId"
    LEFT JOIN public.auctions_sepolia a ON p."hashId" = a."hashId" AND a."settled" = false
    WHERE
        p."slug" = collection_slug
        AND (EXISTS (SELECT 1 FROM public.listings_sepolia l2 WHERE l2."hashId" = p."hashId" AND l2."toAddress" = '0x0000000000000000000000000000000000000000')
             OR EXISTS (SELECT 1 FROM public.bids_sepolia b2 WHERE b2."hashId" = p."hashId")
             OR EXISTS (SELECT 1 FROM public.auctions_sepolia a2 WHERE a2."hashId" = p."hashId" AND a2."settled" = false))
    GROUP BY p."hashId";
END;
$$;
