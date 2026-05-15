CREATE INDEX IF NOT EXISTS ethscriptions_slug_hash_id_idx
ON public.ethscriptions (slug, "hashId");

CREATE INDEX IF NOT EXISTS events_hash_id_block_timestamp_tx_id_idx
ON public.events ("hashId", "blockTimestamp" DESC, "txId");

CREATE INDEX IF NOT EXISTS events_type_hash_id_block_timestamp_tx_id_idx
ON public.events (type, "hashId", "blockTimestamp" DESC, "txId");

CREATE INDEX IF NOT EXISTS events_recent_activity_order_idx
ON public.events ("blockTimestamp" DESC, "txId", "hashId")
INCLUDE ("from", "to", type, value)
WHERE
  type <> 'PhunkNoLongerForSale'
  AND "to" <> '0xd3418772623be1a3cc6b6d45cb46420cedd9154a'
  AND "to" <> ''
  AND "from" <> '';

CREATE INDEX IF NOT EXISTS ethscriptions_sepolia_slug_hash_id_idx
ON public.ethscriptions_sepolia (slug, "hashId");

CREATE INDEX IF NOT EXISTS events_sepolia_hash_id_block_timestamp_tx_id_idx
ON public.events_sepolia ("hashId", "blockTimestamp" DESC, "txId");

CREATE INDEX IF NOT EXISTS events_sepolia_type_hash_id_block_timestamp_tx_id_idx
ON public.events_sepolia (type, "hashId", "blockTimestamp" DESC, "txId");

CREATE INDEX IF NOT EXISTS events_sepolia_recent_activity_order_idx
ON public.events_sepolia ("blockTimestamp" DESC, "txId", "hashId")
INCLUDE ("from", "to", type, value)
WHERE
  type <> 'PhunkNoLongerForSale'
  AND "to" <> '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e'
  AND "to" <> '0xc6a824d8cce7c946a3f35879694b9261a36fc823'
  AND "from" <> '0xc6a824d8cce7c946a3f35879694b9261a36fc823';
