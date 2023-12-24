------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fetch_phunks_owned_with_listings_and_bids(
  address TEXT,
  slug text DEFAULT 'ethereum-phunks'
)
RETURNS TABLE(ethscription JSON) AS $$
DECLARE
    "auctionAddress" CONSTANT TEXT := '0xc6a824d8cce7c946a3f35879694b9261a36fc823';
    "marketAddress" CONSTANT TEXT := '0x53a699992a217c6a802a8986634064de2e213e1c';
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'phunk', json_strip_nulls(json_build_object(
            'hashId', p."hashId",
            'tokenId', p."tokenId",
            'owner', p."owner",
            'prevOwner', p."prevOwner"
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
          AND p."collectionSlug" = slug
    GROUP BY p."hashId";
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------

