create table
  public.users_goerli (
    "createdAt" timestamp with time zone null default now(),
    address text not null,
    points bigint not null default '0'::bigint,
    constraint users_goerli_pkey primary key (address)
  ) tablespace pg_default;

create table
  public.phunk_shas (
    sha text not null,
    "phunkId" bigint not null,
    constraint shas_pkey primary key (sha)
  ) tablespace pg_default;

create table
  public.ethscriptions_goerli (
    "createdAt" timestamp with time zone null default now(),
    creator text null,
    owner text not null,
    "hashId" text not null,
    sha text not null,
    "prevOwner" text null,
    "slug" text null,
    data text null,
    "tokenId" bigint not null default '-1'::bigint,
    constraint phunks_goerli_pkey primary key ("hashId"),
    constraint phunks_goerli_sha_key unique (sha)
  ) tablespace pg_default;

create index if not exists "phunks_goerli_hashId_idx" on public.ethscriptions_goerli using btree ("hashId") tablespace pg_default;

create table
  public.events_goerli (
    "hashId" text not null,
    "from" text not null,
    "to" text not null,
    "blockHash" text not null,
    "txIndex" character varying null,
    "txHash" text not null,
    "blockNumber" bigint null,
    "blockTimestamp" timestamp with time zone null default now(),
    type text null,
    value text null,
    "txId" text not null,
    constraint events_goerli_pkey primary key ("txId"),
    constraint events_goerli_hashid_fkey foreign key ("hashId") references ethscriptions_goerli ("hashId")
  ) tablespace pg_default;

create table
  public.listings_goerli (
    "createdAt" timestamp with time zone not null default now(),
    "hashId" text not null,
    listed boolean not null default false,
    "toAddress" text null,
    "minValue" text not null,
    "listedBy" text not null,
    "txHash" text not null,
    constraint market_listings_pkey primary key ("hashId"),
    constraint listings_goerli_hashid_fkey foreign key ("hashId") references ethscriptions_goerli ("hashId")
  ) tablespace pg_default;

create table
  public.collections_goerli (
    slug text not null,
    "createdAt" timestamp with time zone not null default now(),
    "posterHashId" text null,
    constraint collections_goerli_pkey primary key (slug)
  ) tablespace pg_default;

create table
  public.bids_goerli (
    "createdAt" timestamp with time zone not null default now(),
    "hashId" text not null,
    "fromAddress" text not null,
    value text not null default '0'::text,
    "txHash" text not null,
    constraint bids_goerli_pkey primary key ("hashId"),
    constraint bids_goerli_hashid_fkey foreign key ("hashId") references ethscriptions_goerli ("hashId")
  ) tablespace pg_default;

create table
  public.auctions_goerli (
    "auctionId" bigint generated by default as identity,
    "createdAt" timestamp with time zone not null default now(),
    "hashId" text not null,
    amount text not null default '0'::text,
    "startTime" timestamp with time zone null,
    "endTime" timestamp with time zone null,
    bidder text null,
    settled boolean not null default false,
    "prevOwner" text null,
    constraint auctions_goerli_pkey primary key ("auctionId"),
    constraint auctions_goerli_hashid_fkey foreign key ("hashId") references ethscriptions_goerli ("hashId")
  ) tablespace pg_default;

create table
  public."auctionBids_goerli" (
    id bigint generated by default as identity,
    "createdAt" timestamp with time zone not null default now(),
    "auctionId" bigint not null,
    "fromAddress" text not null default ''::text,
    amount text not null default '0'::text,
    "txHash" text not null,
    constraint auctionbids_goerli_pkey primary key (id)
  ) tablespace pg_default;
