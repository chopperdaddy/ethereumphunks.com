import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { Transaction, zeroAddress } from 'viem';
import { Observable } from 'rxjs';

import * as db from '@/modules/storage/models/db';
import { Ethscription } from '@/modules/storage/models/db';

import { TIC } from '@/modules/comments/models/tic';
import { AppConfigService } from '@/config/config.service';

@Injectable()
export class StorageService implements OnModuleInit {

  supabase: SupabaseClient;
  suffix: string;

  constructor(
    private readonly configSvc: AppConfigService
  ) {}

  onModuleInit() {
    this.suffix = this.configSvc.chain.chainIdL1 === 1 ? '' : '_sepolia';

    this.supabase = createClient(
      this.configSvc.supabase.url,
      this.configSvc.supabase.serviceRoleKey
    );
  }

  /**
   * Updates the last processed block number
   * @param blockNumber - The block number to update to
   * @param createdAt - Timestamp of when this block was processed
   */
  async updateLastBlock(blockNumber: number, createdAt: Date): Promise<void> {
    const response = await this.supabase
      .from('blocks')
      .upsert({
        network: this.configSvc.chain.chainIdL1,
        blockNumber,
        createdAt,
      });

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Gets the last processed block number for a network
   * @param network - The network ID to get the last block for
   * @returns The last processed block number minus 10 blocks for safety, or null if no blocks processed
   */
  async getLastBlock(network: number): Promise<any> {
    const response = await this.supabase
      .from('blocks')
      .select('*')
      .eq('network', network);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0]?.blockNumber - 10;
    return null;
  }

  /**
   * Removes a bid from the database
   * @param hashId - The hash ID of the bid to remove
   */
  async removeBid(hashId: string): Promise<void> {
    const response: db.ListingResponse = await this.supabase
      .from('bids' + this.suffix)
      .delete()
      .eq('hashId', hashId);
    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Removed bid', hashId);
  }

  /**
   * Creates a new bid in the database
   * @param txn - The transaction containing the bid
   * @param createdAt - Timestamp when bid was created
   * @param hashId - Hash ID of the bid
   * @param fromAddress - Address that placed the bid
   * @param value - Bid amount in wei
   */
  async createBid(
    txn: Transaction,
    createdAt: Date,
    hashId: string,
    fromAddress: string,
    value: bigint
  ): Promise<void> {
    const response: db.ListingResponse = await this.supabase
      .from('bids' + this.suffix)
      .upsert({
        createdAt,
        hashId,
        value: value.toString(),
        fromAddress: fromAddress.toLowerCase(),
        txHash: txn.hash.toLowerCase(),
      });

    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Created bid', hashId);
  }

  /**
   * Gets a bid by its hash ID
   * @param hashId - The hash ID of the bid to get
   * @returns The bid if found, null otherwise
   */
  async getBid(hashId: string): Promise<db.Bid> {
    const response: db.BidResponse = await this.supabase
      .from('bids' + this.suffix)
      .select('*')
      .eq('hashId', hashId);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0] as db.Bid;
    return null;
  }

  /**
   * Creates a new listing in the database
   * @param txn - The transaction containing the listing
   * @param createdAt - Timestamp when listing was created
   * @param hashId - Hash ID of the listing
   * @param toAddress - Address that can purchase the listing
   * @param minValue - Minimum price in wei
   * @param l2 - Whether this is an L2 listing
   */
  async createListing(
    txn: Transaction,
    createdAt: Date,
    hashId: string,
    toAddress: string,
    minValue: bigint,
    l2: boolean = false
  ): Promise<void> {
    const response: db.ListingResponse = await this.supabase
      .from('listings' + this.suffix)
      .upsert({
        hashId,
        createdAt,
        txHash: txn.hash.toLowerCase(),
        listed: true,
        minValue: minValue.toString(),
        listedBy: txn.from.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        l2,
      });

    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log(
      'Listing created',
      hashId
    );
  }

  /**
   * Removes a listing from the database
   * @param hashId - The hash ID of the listing to remove
   * @returns True if listing was found and removed, false if not found
   */
  async removeListing(hashId: string): Promise<boolean> {

    const listing = await this.getListing(hashId);
    if (!listing) return false;

    const response: db.ListingResponse = await this.supabase
      .from('listings' + this.suffix)
      .delete()
      .eq('hashId', hashId)

    const { data, error } = response;
    if (error) throw error;

    Logger.log(
      'Removed listing',
      hashId
    );
    return true;
  }

  /**
   * Updates a listing in the database
   */
  async updateListing() {}

  ////////////////////////////////////////////////////////////////////////////////
  // Checks //////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Checks if a SHA matches a curated collection
   * @param sha - The SHA to check
   * @returns The attribute data if it's a curated collection, null otherwise
   */
  async checkIsCuratedCollection(sha: string): Promise<db.AttributeItem | null> {
    const response: db.AttributesResponse = await this.supabase
      .from('attributes_new')
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  /**
   * Checks if an ethscription exists by its SHA
   * @param sha - The SHA to check
   * @returns True if ethscription exists, false otherwise
   */
  async checkEthscriptionExistsBySha(sha: string): Promise<boolean> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (!data?.length) return false;
    return true;
  }

  /**
   * Checks if an ethscription exists by its hash ID
   * @param hash - The hash ID to check
   * @returns The ethscription if found, null otherwise
   */
  async checkEthscriptionExistsByHashId(hash: string): Promise<db.Ethscription> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('hashId', hash?.toLowerCase());

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  /**
   * Checks if multiple ethscriptions exist by their hash IDs
   * @param hashes - Array of hash IDs to check
   * @returns Array of found ethscriptions, null if none found
   */
  async checkEthscriptionsExistsByHashIds(hashes: string[]): Promise<Ethscription[]> {
    if (!hashes.length) return null;

    // We check these in batches of 100
    const batchSize = 100;
    let results: Ethscription[] = [];

    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.slice(i, i + batchSize);

      const response: db.EthscriptionResponse = await this.supabase
        .from('ethscriptions' + this.suffix)
        .select('*')
        .in('hashId', batch.map((hash) => hash.toLowerCase()));

      const { data, error } = response;
      // console.log({ data, error });

      if (error) throw error;
      if (data?.length) results = results.concat(data);
    }

    return results.length ? results : null;
  }

  /**
   * Fetches an ethscription by its collection slug and token ID
   * @param slug - The collection slug
   * @param id - The token ID
   * @returns The ethscription if found, null otherwise
   */
  async fetchEthscriptionBySlugAndTokenId(slug: string, id: number): Promise<db.Ethscription> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('tokenId', id)
      .eq('slug', slug);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  /**
   * Fetches a collection by its slug
   * @param slug - The slug of the collection
   * @returns The collection
   */
  async fetchCollection(slug: string): Promise<any> {
    const response = await this.supabase
      .from('collections' + this.suffix)
      .select('*')
      .eq('slug', slug);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  /**
   * Creates a new collection and sets it to inactive
   * @param collection - The collection to create
   */
  async createCollection(collection: db.Collection): Promise<void> {
    const response: db.CollectionResponse = await this.supabase
      .from('collections' + this.suffix)
      .insert({
        ...collection,
        active: false
      });

    const { error } = response;
    if (error) throw error;
    Logger.log('Collection added', collection.slug);
  }

  async fetchCollectionsWithPreviews() {
    const res = this.supabase.rpc('fetch_collections_with_previews', { preview_limit: 4 });
    const { data, error } = await res;
    if (error) throw error;
    return data;
  }

  /**
   * Fetches all ethscriptions
   * @param slug - The slug of the collection
   * @returns All ethscriptions
   */
  async fetchAllEthscriptions(
    slug?: string,
  ): Promise<Ethscription[]> {
    const pageSize = 1000; // Max rows per request

    let allPhunks: any[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const req = this.supabase
        .from('ethscriptions' + this.suffix)
        .select('hashId, creator, owner, prevOwner, slug, tokenId, sha')
        .order('tokenId', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (slug) req.eq('slug', slug);

      const { data, error } = await req;

      if (error) {
        console.error('Error fetching data:', error);
        throw error;
      }

      if (data) {
        allPhunks = allPhunks.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allPhunks;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Storage /////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Fetches collection data from storage
   * @param slug - The slug of the collection
   * @returns The collection data
   */
  async getCollectionData(slug: string): Promise<any> {
    // Requires a service role token
    const { data, error } = await this.supabase.storage
      .from('mint-data')
      .download(`${slug}.json`);

    if (error) throw error;
    return JSON.parse(await data.text());
  }

  /**
   * Fetches a mint image by its SHA
   * @param sha - The SHA of the image
   * @returns The image data
   */
  async getMintImageBySha(sha: string): Promise<{ buffer: Buffer; mimeType: string }> {
    // Requires a service role token
    const { data, error } = await this.supabase.storage
      .from('mint-images')
      .download(`${sha}`);

    if (error) throw error;

    // Get mime type from the blob
    const mimeType = data.type;
    const buffer = Buffer.from(await data.arrayBuffer());

    return { buffer, mimeType };
  }

  /**
   * Uploads an image to storage
   * @param imageBuffer - The image data buffer
   * @param sha - The SHA of the image
   * @param extension - The extension of the image
   * @param slug - The slug of the collection
   */
  async uploadImage(
    imageBuffer: Buffer,
    sha: string,
    extension: string,
    slug: string
  ): Promise<void> {
    const { data, error } = await this.supabase.storage
      .from('static/images')
      .upload(
        sha,
        imageBuffer,
        { contentType: `image/${extension}`, metadata: { slug }, upsert: true }
      );

    if (error) Logger.error(error.message, 'Error uploading image');
    if (data) Logger.log('Uploaded image', `${sha}`);
  }

  /**
   * Uploads an attributes file to storage
   * @param slug - The slug of the collection
   * @param attributesFile - The attributes file buffer
   */
  async uploadAttributesFile(slug: string, attributesFile: Buffer) {
    const fileName = `${slug}_attributes.json`;
    const { data, error } = await this.supabase.storage
      .from('data')
      .upload(fileName, attributesFile, {upsert: true});

    if (error) Logger.error(error.message, 'Error uploading attributes file');
    if (data) Logger.log('Uploaded attributes file', `${fileName}`);
  }

  /**
   * Checks if a collection is minting and minting is enabled
   * @param slug - The slug of the collection
   * @returns True if the collection is minting and minting is enabled, false otherwise
   */
  async isMinting(slug: string): Promise<boolean> {
    const response: db.CollectionResponse = await this.supabase
      .from('collections' + this.suffix)
      .select('*')
      .eq('slug', slug);

    const { data, error } = response;
    // console.log({ data, error });
    if (error) throw error;
    if (data?.length) return data[0].isMinting && data[0].mintEnabled;
    return false;
  }

  watchCollection(slug: string): Observable<any> {
    const changes$ = new Observable(subscriber => {
      const channel = this.supabase
        .channel('collections' + this.suffix)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collections' + this.suffix,
            filter: `slug=eq.${slug}`
          },
          payload => subscriber.next((payload as any).new)
        )
        .subscribe();

      return () => channel.unsubscribe();
    });

    return changes$;
  }

  /**
   * Fetches the mint progress for a collection
   * @param slug - The slug of the collection
   * @returns The mint progress and total supply
   */
  async fetchMintProgress(slug: string): Promise<{ progress: number, total: number }> {
    const query = this.supabase
      .from('ethscriptions' + this.suffix)
      .select('*', { count: 'exact', head: true })
      .eq('slug', slug);

    const { count, error } = await query;
    if (error) throw error;

    const totalSupply = await this.getCollectionBySlug(slug);
    return { progress: count, total: totalSupply.supply };
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Adds ////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Adds a new ethscription to the database
   * @param txn - The transaction containing the ethscription
   * @param createdAt - Timestamp when ethscription was created
   * @param attributesData - The attributes data for the ethscription
   */
  async addEthscription(
    txn: Transaction,
    createdAt: Date,
    attributesData: db.AttributeItem,
  ): Promise<void> {

    // Get or create the users
    if (txn.from.toLowerCase() === txn.to.toLowerCase()) {
      await this.getOrCreateUser(txn.from, createdAt);
    } else {
      await Promise.all([
        this.getOrCreateUser(txn.from, createdAt),
        this.getOrCreateUser(txn.to, createdAt)
      ]);
    }

    const { error }: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .insert([
        {
          createdAt,
          creator: txn.from.toLowerCase(),
          prevOwner: txn.from.toLowerCase(),
          owner: txn.to.toLowerCase(),
          hashId: txn.hash.toLowerCase(),
          sha: attributesData.sha,
          slug: attributesData.slug,
          tokenId: attributesData.tokenId,
        },
      ]);

    if (error) throw error.message;
    Logger.log('Ethscription created', txn.hash.toLowerCase());
  }

  /**
   * Adds a new event to the database
   * @param txn - The transaction containing the event
   * @param from - Address event is from
   * @param to - Address event is to
   * @param hashId - Hash ID of the event
   * @param type - Type of event
   * @param createdAt - Timestamp when event was created
   * @param value - Value associated with event in wei
   * @param logIndex - Index of the event log
   */
  async addEvent(
    txn: Transaction,
    from: string,
    to: string,
    hashId: string,
    type: db.EventType,
    createdAt: Date,
    value: bigint,
    logIndex: number
  ): Promise<void> {

    // Get or create the users
    if (from.toLowerCase() === to.toLowerCase()) await this.getOrCreateUser(from, createdAt);
    else {
      await Promise.all([
        this.getOrCreateUser(from, createdAt),
        this.getOrCreateUser(to, createdAt)
      ]);
    }

    const txId = `${txn.hash.toLowerCase()}-${logIndex}`;
    const response: db.EventResponse = await this.supabase
      .from('events' + this.suffix)
      .upsert({
        txId,
        blockTimestamp: createdAt,
        type,
        value: value.toString(),
        hashId: hashId.toLowerCase(),
        from: from.toLowerCase(),
        to: (to || zeroAddress).toLowerCase(),
        blockNumber: Number(txn.blockNumber),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        txHash: txn.hash.toLowerCase(),
      }, {
        ignoreDuplicates: true,
      });

    const { error } = response;
    if (error) Logger.error(error.message, txn.hash.toLowerCase());
    Logger.log('Event created', txn.hash.toLowerCase());
  }

  /**
   * Adds multiple events to the database
   * @param events - Array of events to add
   */
  async addEvents(events: db.Event[]): Promise<void> {

    events = events.map((event, i) => {
      event.txId = `${event.txHash.toLowerCase()}-${event.txIndex}-${i}`;
      event.from = event.from.toLowerCase();
      event.to = event.to.toLowerCase();
      event.txHash = event.txHash.toLowerCase();
      event.hashId = event.hashId.toLowerCase();
      return event;
    });

    const response: db.EventResponse = await this.supabase
      .from('events' + this.suffix)
      .upsert(events, {
        ignoreDuplicates: true,
      });

    const { error } = response;
    if (error) throw error.message;
    Logger.log(
      `${events.length} events added (L1)`,
      `Block ${events[0].blockNumber.toString()}`
    );
  }

  /**
   * Gets or creates a user in the database
   * @param address - The user's address
   * @param createdAt - Optional timestamp for when user was created
   * @returns The user object
   */
  async getOrCreateUser(address: string, createdAt?: Date): Promise<db.User> {
    if (!address) return null;

    const response: db.UserResponse = await this.supabase
      .from('users' + this.suffix)
      .select('*')
      .eq('address', address.toLowerCase());

    const { data, error } = response;
    // console.log({ data, error });

    if (error) throw error;
    if (data.length) return data[0];

    const newUserResponse: db.UserResponse = await this.supabase
      .from('users' + this.suffix)
      .insert({
        address: address.toLowerCase(),
        createdAt: createdAt || new Date()
      })
      .select();

    const { data: newUser, error: newError } = newUserResponse;
    // console.log({ newUser, newError });

    if (newError) throw newError.message;
    Logger.log('User created', address);
    if (newUser?.length) return newUser[0];
  }

  /**
   * Gets a collection by its slug
   * @param slug - The collection slug
   * @returns The collection if found, null otherwise
   */
  async getCollectionBySlug(slug: string): Promise<any> {
    const response = await this.supabase
      .from('collections' + this.suffix)
      .select('*')
      .eq('slug', slug);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  async addAttributesNew(data: db.AttributeItem[]) {
    const res = await this.supabase
      .from('attributes_new')
      .upsert(data);

    const { error } = res;
    if (error) throw error;

    Logger.log('Added attributes', `${data.length} items`);
  }

  /**
   * Gets attributes data by SHA
   * @param sha - The SHA to look up
   * @returns The attributes if found, null otherwise
   */
  async getAttributesFromSha(sha: string): Promise<any> {
    const response = await this.supabase
      .from('attributes_new')
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Updates /////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Updates the owner of an ethscription
   * @param hashId - The hash ID of the ethscription
   * @param prevOwner - The previous owner's address
   * @param newOwner - The new owner's address
   */
  async updateEthscriptionOwner(
    hashId: string,
    prevOwner: string,
    newOwner: string
  ): Promise<void> {

    // Get or create the users
    await this.getOrCreateUser(newOwner);

    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .update({
        owner: newOwner.toLowerCase(),
        prevOwner: prevOwner.toLowerCase(),
      })
      .eq('hashId', hashId);

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Updates an event in the database
   * @param eventId - The ID of the event to update
   * @param data - The data to update
   */
  async updateEvent(eventId: number, data: any): Promise<void> {
    const response: db.EventResponse = await this.supabase
      .from('events' + this.suffix)
      .update(data)
      .eq('txId', eventId);

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Updates a user's points
   * @param address - The user's address
   * @param points - The new points value
   */
  async updateUserPoints(address: string, points: number): Promise<void> {
    const response: db.UserResponse = await this.supabase
      .from('users' + this.suffix)
      .update({ points })
      .eq('address', address.toLowerCase());

    const { error } = response;
    if (error) throw error;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Auction House ///////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Creates a new auction in the database
   * @param args - Object containing auction details
   * @param createdAt - Timestamp when auction was created
   */
  async createAuction(
    args: {
      hashId: string;
      owner: string;
      auctionId: bigint;
      startTime: bigint;
      endTime: bigint;
    },
    createdAt: Date
  ): Promise<void> {
    const response: db.AuctionResponse = await this.supabase
      .from('auctions' + this.suffix)
      .upsert({
        auctionId: Number(args.auctionId),
        createdAt,
        hashId: args.hashId.toLowerCase(),
        prevOwner: args.owner.toLowerCase(),
        amount: '0',
        startTime: new Date(Number(args.startTime) * 1000),
        endTime: new Date(Number(args.endTime) * 1000),
        bidder: zeroAddress,
        settled: false,
      });

    const { error } = response;
    if (error) throw error;

    Logger.log('Auction created', args.hashId);
  }

  /**
   * Creates a new auction bid in the database
   * @param args - Object containing bid details
   * @param txn - The transaction containing the bid
   * @param createdAt - Timestamp when bid was created
   */
  async createAuctionBid(
    args: {
      hashId: string,
      auctionId: bigint,
      sender: string,
      value: bigint,
      extended: boolean
    },
    txn: Transaction,
    createdAt: Date
  ): Promise<void> {
    const { data: auctionsData, error: auctionsError } = await this.supabase
      .from('auctions' + this.suffix)
      .update({
        amount: args.value.toString(),
        bidder: args.sender.toLowerCase()
      })
      .eq('auctionId', Number(args.auctionId));

    if (auctionsError) throw auctionsError;

    const { data: bidsData, error: bidsError } = await this.supabase
      .from('auctionBids' + this.suffix)
      .insert({
        auctionId: Number(args.auctionId),
        createdAt: createdAt,
        fromAddress: args.sender.toLowerCase(),
        amount: args.value.toString(),
        txHash: txn.hash.toLowerCase(),
      });

    if (bidsError) throw bidsError;
    Logger.log(`Bid created`, args.hashId);
  }

  /**
   * Settles an auction in the database
   * @param args - Object containing settlement details
   */
  async settleAuction(
    args: {
      hashId: string,
      auctionId: bigint,
      winner: string,
      amount: bigint
    }
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('auctions' + this.suffix)
      .update({
        settled: true,
      })
      .eq('hashId', args.hashId.toLowerCase());

    if (error) throw error;
    Logger.log(`Auction settled`, args.hashId);
  }

  /**
   * Extends an auction's end time
   * @param args - Object containing extension details
   */
  async extendAuction(
    args: {
      hashId: string,
      auctionId: bigint,
      endTime: bigint
    }
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('auctions' + this.suffix)
      .update({
        endTime: new Date(Number(args.endTime) * 1000),
      })
      .eq('auctionId', Number(args.auctionId));

    if (error) throw error;
    Logger.log(`Auction extended`, args.hashId);
  }

  /**
   * Gets an auction by its hash ID
   * @param hashId - The hash ID to look up
   * @returns The auction if found, null otherwise
   */
  async getAuctionById(auctionId: number): Promise<db.Auction> {
    const response: db.AuctionResponse = await this.supabase
      .from('auctions' + this.suffix)
      .select('*')
      .eq('auctionId', auctionId);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Gets ////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Gets an ethscription by its token ID
   * @param tokenId - The token ID to look up
   * @returns The ethscription if found, undefined otherwise
   */
  async getEthscriptionBySha(sha: string): Promise<db.Ethscription> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }

  /**
   * Gets a listing by its hash ID
   * @param hashId - The hash ID to look up
   * @returns The listing if found, null otherwise
   */
  async getListing(hashId: string): Promise<any> {
    const response = await this.supabase
      .from('listings' + this.suffix)
      .select('*')
      .eq('hashId', hashId);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  /**
   * Gets all transfer events
   * @returns Array of transfer events
   */
  async getAllTransfers(): Promise<db.Event[]> {
    const response: db.EventResponse = await this.supabase
      .from('events' + this.suffix)
      .select('*')
      .eq('type', 'transfer');

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data;
  }

  /**
   * Gets unminted token IDs and writes them to a file
   */
  async getUnminted(): Promise<void> {
    let allPhunks: any[] = [];
    const pageSize = 1000; // Max rows per request
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('phunks_sepolia')
        .select('phunkId')
        .order('phunkId', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching data:', error);
        throw error;
      }

      if (data) {
        allPhunks = allPhunks.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const sorted = allPhunks.sort((a, b) => Number(a.phunkId) - Number(b.phunkId));
    let i = 0;
    let unminted = [];

    sorted.forEach((phunk) => {
        let currentId = Number(phunk.phunkId);
        while (i < currentId) {
            unminted.push(i);
            i++;
        }
        i = currentId + 1;
    });

    console.log(JSON.stringify(sorted));
    console.log(JSON.stringify(unminted));
  }

  /**
   * Gets an event by its hash ID
   * @param hashId - The hash ID to look up
   * @returns The event if found, undefined otherwise
   */
  async getEventByHashId(hashId: string): Promise<db.Event> {
    const response: db.EventResponse = await this.supabase
      .from('events' + this.suffix)
      .select('*')
      .order('blockTimestamp', { ascending: false })
      .eq('hashId', hashId.toLowerCase());

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Comments ////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Adds a new comment to the database
   * @param txn - The transaction containing the comment
   * @param createdAt - Timestamp when comment was created
   */
  async addComment(tic: TIC, txn: Transaction, createdAt: Date): Promise<void> {

    const topicType =
      tic.topic?.length === 42 ? 'address' :
      tic.topic?.length === 66 ? 'hash' :
      undefined;

    const comment: db.DBComment = {
      id: txn.hash.toLowerCase(),
      topic: tic.topic?.toLowerCase(),
      topicType,
      content: tic.content,
      version: tic.version,
      encoding: tic.encoding || 'utf8',
      createdAt,
      from: txn.from.toLowerCase(),
    };

    const response: db.CommentResponse = await this.supabase
      .from('comments' + this.suffix)
      .upsert(comment);

    const { error, data } = response;

    if (error) throw error;
  }

  /**
   * Gets a comment by its hash ID
   * @param hashId - The hash ID to look up
   * @returns The comment if found
   */
  async getCommentByHashId(hashId: string): Promise<db.DBComment> {
    const response: db.CommentResponse = await this.supabase
      .from('comments' + this.suffix)
      .select('*')
      .eq('id', hashId.toLowerCase());

    const { data, error } = response;
    if (error) throw error;
    return data[0];
  }

  /**
   * Marks a comment as deleted
   * @param hashId - The hash ID of the comment to delete
   */
  async deleteComment(hashId: string): Promise<void> {
    const response: db.CommentResponse = await this.supabase
      .from('comments' + this.suffix)
      .update({ deleted: true })
      .eq('id', hashId.toLowerCase());

    const { error } = response;
    if (error) throw error;
  }


  // Bridge //////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Locks an ethscription
   * @param hashId - The hash ID of the ethscription to lock
   * @returns True if the ethscription was locked, false otherwise
   */
  async lockEthscription(hashId: string): Promise<boolean> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .update({
        locked: true,
      })
      .eq('hashId', hashId.toLowerCase())
      .select();

    const { data, error } = response;
    if (error) throw error;
    return data[0].locked;
  }

  /**
   * Unlocks an ethscription
   * @param hashId - The hash ID of the ethscription to unlock
   * @returns True if the ethscription was unlocked, false otherwise
   */
  async unlockEthscription(hashId: string): Promise<boolean> {
    const response: db.EthscriptionResponse = await this.supabase
      .from('ethscriptions' + this.suffix)
      .update({
        locked: false,
      })
      .eq('hashId', hashId.toLowerCase())
      .select();

    const { data, error } = response;
    if (error) throw error;
    return data[0].locked;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // L2 //////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  /**
   * Adds an NFT to the L2 database
   * @param tokenId - The token ID of the NFT
   * @param owner - The owner of the NFT
   * @param hashId - The hash ID of the NFT
   */
  async addNftL2(
    tokenId: number,
    owner: string,
    hashId: string,
  ): Promise<void> {
    const response: db.EventResponse = await this.supabase
      .from('nfts' + this.suffix)
      .upsert({
        tokenId,
        owner: owner.toLowerCase(),
        hashId: hashId.toLowerCase(),
      });

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Updates the owner of an NFT in the L2 database
   * @param tokenId - The token ID of the NFT
   * @param owner - The new owner of the NFT
   */
  async updateNftL2(tokenId: number, owner: string): Promise<void> {
    const response: db.EventResponse = await this.supabase
      .from('nfts' + this.suffix)
      .update({ owner: owner.toLowerCase() })
      .eq('tokenId', tokenId);

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Removes an NFT from the L2 database
   * @param tokenId - The token ID of the NFT
   * @param hashId - The hash ID of the NFT
   */
  async removeNftL2(tokenId: number, hashId: string): Promise<void> {
    const response: db.EventResponse = await this.supabase
      .from('nfts' + this.suffix)
      .delete()
      .eq('hashId', hashId)
      .eq('tokenId', tokenId);

    const { error } = response;
    if (error) throw error;
  }

  /**
   * Adds an event to the L2 database
   * @param event - The event to add
   */
  async addEventL2(event: any): Promise<void> {
    const response: db.EventResponse = await this.supabase
      .from('l2_events' + this.suffix)
      .upsert(event);

    const { error } = response;
    if (error) throw error;
  }

  ///////////////////////////////////////////////////////////////
  // NOTIFICATIONS //////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////

  /**
   * Retrieves full Ethscription data including collection and attributes
   * @param hashId The Ethscription hash ID
   * @returns Ethscription data with collection and attributes
   * !FIXME: Update to use new attributes!
   */
  async getEthscriptionWithCollectionAndAttributes(
    hashId: string
  ): Promise<db.EthscriptionWithCollectionAndAttributes> {

    const response = this.supabase
      .from(`ethscriptions${this.suffix}`)
      .select(`
        *,
        collections${this.suffix}!inner(
          name,
          singleName,
          notifications
        ),
        attributes_new!inner(
          values
        )
      `)
      .eq('hashId', hashId)
      .limit(1)
      .single();

    const { data, error } = await response;
    if (error) throw error;
    if (!data) return null;

    const collection = data[`collections${this.suffix}`];
    const attributes = data['attributes_new'];

    return {
      ethscription: data as unknown as db.Ethscription,
      collection,
      attributes,
    };
  }

  /**
   * Listens for Phunk sale events from Supabase
   * @returns An Observable that emits Phunk sale events
   */
  listenSales(): Observable<db.Event> {
    return new Observable(subscriber => {
      const subscription = this.supabase
        .channel(`sales${this.suffix}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: `events${this.suffix}`,
          filter: 'type=eq.PhunkBought'
        }, payload => {
          // console.log(payload.new);
          subscriber.next(payload.new as db.Event);
        })
        .subscribe();

      // Return cleanup function
      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * Retrieves the latest Phunk bought event by hash ID
   * @param hashId The hash ID of the Phunk
   * @returns The latest Phunk bought event
   */
  async getLatestBoughtEventByHashId(hashId: string): Promise<db.Event> {
    const response = this.supabase
      .from(`events${this.suffix}`)
      .select('*')
      .eq('type', 'PhunkBought')
      .eq('hashId', hashId)
      .order('blockTimestamp', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await response;

    if (error) throw error;
    return data;
  }

  async setConnectedAccounts(accounts: string[]): Promise<void> {
    const response = await this.supabase
      .from('connected_accounts')
      .upsert({
        id: accounts[0],
        publicKeys: accounts
      });

    const { error } = response;
    if (error) console.log(error);
  }

  async deleteEthscription(hashId: string): Promise<void> {
    const chainId = this.configSvc.chain.chainIdL1;
    if (chainId !== 11155111) throw new Error('Cannot only delete ethscriptions on Sepolia');

    await this.removeListing(hashId);
    await this.removeAllEventsByHashId(hashId);

    const response = await this.supabase
      .from('ethscriptions' + this.suffix)
      .delete()
      .eq('hashId', hashId);

    const { error } = response;
    if (error) console.log(error);
  }

  private async removeAllEventsByHashId(hashId: string): Promise<void> {
    const response = await this.supabase
      .from('events' + this.suffix)
      .delete()
      .eq('hashId', hashId.toLowerCase());

    Logger.log('Removed events', hashId);
    const { error } = response;
    if (error) throw error;
  }
}
