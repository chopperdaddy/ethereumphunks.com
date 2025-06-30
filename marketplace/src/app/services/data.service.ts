import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';
import { StorageService } from '@/services/storage.service';

import { EventType, GlobalConfig, GlobalState } from '@/models/global-state';
import { Auction, Event, Listing, Phunk } from '@/models/db';
import { Attribute } from '@/models/attributes';
import { MarketState } from '@/models/market.state';
import { CommentWithReplies } from '@/models/comment';
import { Collection } from '@/models/data.state';
import { AttributeItem } from '@/models/attributes';

import { createClient, RealtimePostgresUpdatePayload, RealtimePostgresInsertPayload } from '@supabase/supabase-js'

import { Observable, of, from, forkJoin, firstValueFrom, EMPTY, timer, merge, filter, share, catchError, debounceTime, expand, map, reduce, switchMap, takeWhile, tap, shareReplay } from 'rxjs';

import { environment } from '@environments/environment';

import * as dataStateActions from '@/state/data/data-state.actions';
import * as appStateActions from '@/state/app/app-state.actions';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);

@Injectable({
  providedIn: 'root'
})
export class DataService {

  public suffix: string = environment.chainId === 1 ? '' : '_sepolia';
  staticUrl = environment.staticUrl;
  escrowAddress = environment.marketAddress;

  walletAddress$ = this.store.select(state => state.appState.walletAddress);

  private attributeCache = new Map<string, Observable<AttributeItem | null>>();

  constructor(
    @Inject(Web3Service) private web3Svc: Web3Service,
    private store: Store<GlobalState>,
    private http: HttpClient,
    private storageSvc: StorageService,
  ) {

    // Listen for blocks and set indexer block
    this.listenForBlocks().pipe(
      tap((blockNumber) => {
        this.store.dispatch(appStateActions.setIndexerBlock({ indexerBlock: blockNumber }));
      }),
    ).subscribe();

    // Fetch current ETH/USD price and store it
    this.fetchUSDPrice().pipe(
      tap((res) => this.store.dispatch(dataStateActions.setUsd({ usd: res }))),
    ).subscribe();
  }

  /**
   * Sets up real-time listener for global config changes
   */
  fetchGlobalConfig(): Observable<GlobalConfig> {
    const initial$ = from(
      supabase
        .from('_global_config')
        .select('*')
        .eq('network', environment.chainId)
        .limit(1)
    ).pipe(
      map(({ data }) => {
        const config = data?.[0];
        if (!config) return null;
        if (environment.standalone) {
          config.defaultCollection = environment.defaultCollection;
        }
        return config;
      }),
    );

    const changes$ = new Observable(subscriber => {
      const channel = supabase
        .channel('_global_config')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: '_global_config',
            filter: `network=eq.${environment.chainId}`
          },
          payload => subscriber.next((payload as any).new)
        )
        .subscribe();

      return () => channel.unsubscribe();
    });

    return merge(
      initial$,
      changes$.pipe(switchMap(() => initial$))
    ).pipe(
      filter(config => !!config),
      // tap((config) => console.log('fetchGlobalConfig', config)),
    );
  }

  /**
   * Sets up real-time listener for new blocks
   */
  listenForBlocks(): Observable<number> {
    const blockQuery = supabase
      .from('blocks')
      .select('blockNumber')
      .eq('network', environment.chainId);

    // Initial fetch
    const initial$ = from(blockQuery).pipe(
      map((res: any) => res.data[0]?.blockNumber || 0)
    );

    // Realtime changes
    const changes$ = new Observable<number>(subscriber => {
      const channel = supabase
        .channel('blocks')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocks'
          },
          (payload: any) => {
            if (payload.new.network !== environment.chainId) return;
            subscriber.next(payload.new.blockNumber);
          }
        )
        .subscribe();

      return () => channel.unsubscribe();
    });

    return merge(initial$, changes$).pipe(
      share()
    );
  }

  /**
   * Fetches attributes for a collection
   * @param slug Collection slug
   */
  getAttributes(slug: string): Observable<AttributeItem | null> {
    if (!this.attributeCache.has(slug)) {
      const attributes$ = from(this.storageSvc.getItem<AttributeItem>(`${slug}__attributes`)).pipe(
        switchMap((res: AttributeItem | null) => {
          if (res) return of(res);
          return this.fetchAttributes(slug);
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.attributeCache.set(slug, attributes$);
    }
    return this.attributeCache.get(slug)!;
  }

  /**
   * Fetches attributes for a collection from the static URL
   * @param slug Collection slug
   */
  fetchAttributes(slug: string): Observable<AttributeItem> {
    return this.http.get<AttributeItem>(`${environment.staticUrl}/data/${slug}_attributes.json`).pipe(
      switchMap((res: AttributeItem) => from(this.cacheAttributes(slug, res))),
      tap((res: AttributeItem) => this.createFilters(slug, res)),
    );
  }

  /**
   * Caches attributes for a collection
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async cacheAttributes(slug: string, attributes: AttributeItem) {
    const stored = await this.storageSvc.setItem<AttributeItem>(`${slug}__attributes`, attributes);
    return stored;
  }

  /**
   * Creates filters for a collection
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async createFilters(slug: string, attributes: AttributeItem) {
    // Create a map to store unique attribute keys and their possible values
    const attributeMap = new Map<string, Set<string>>();
    // Track which attributes are present in all items
    const attributeCount = new Map<string, number>();
    // Track frequency of each value for each attribute
    const valueFrequency = new Map<string, Map<string, number>>();
    const totalItems = Object.keys(attributes).length;

    // Iterate through all attributes for each item
    Object.values(attributes).forEach((item: Attribute[]) => {
      // Track which attributes are present in this item
      const presentAttributes = new Set<string>();

      item.forEach((attribute: Attribute) => {
        // Skip Description and Name attributes since they aren't used for filtering
        if (attribute.k === 'Description' || attribute.k === 'Name') return;

        // Initialize a new Set for this attribute key if it doesn't exist
        if (!attributeMap.has(attribute.k)) {
          attributeMap.set(attribute.k, new Set());
          valueFrequency.set(attribute.k, new Map<string, number>());
        }

        // Get the attribute values
        const value = attribute.v;
        // Handle both array and single string values
        if (Array.isArray(value)) {
          // Add each value from the array to the Set
          value.forEach(v => {
            attributeMap.get(attribute.k)?.add(v);
            const freqMap = valueFrequency.get(attribute.k)!;
            freqMap.set(v, (freqMap.get(v) || 0) + 1);
          });
        } else {
          // Add the single value to the Set
          attributeMap.get(attribute.k)?.add(value);
          const freqMap = valueFrequency.get(attribute.k)!;
          freqMap.set(value, (freqMap.get(value) || 0) + 1);
        }

        // Mark this attribute as present in this item
        presentAttributes.add(attribute.k);
      });

      // Update count for each attribute present in this item
      presentAttributes.forEach(attr => {
        attributeCount.set(attr, (attributeCount.get(attr) || 0) + 1);
      });
    });

    // Convert the Map of Sets into a plain object with arrays
    const attributeObject: { [key: string]: string[] } = {};
    attributeMap.forEach((values, key) => {
      // Sort values by frequency (most common first)
      const sortedValues = Array.from(values).sort((a, b) => {
        const freqA = valueFrequency.get(key)!.get(a) || 0;
        const freqB = valueFrequency.get(key)!.get(b) || 0;
        return freqB - freqA; // Sort in descending order of frequency
      });

      // Add "none" option if the attribute isn't present in all items
      if (attributeCount.get(key) !== totalItems) {
        sortedValues.unshift('none');
      }

      attributeObject[key] = sortedValues;
    });

    // Store the filters object in local storage and return it
    const stored = await this.storageSvc.setItem(`${slug}__filters`, attributeObject);
    return stored;
  }

  /**
   * Gets filters for a collection
   * @param slug Collection slug
   */
  async getFilters(slug: string): Promise<{ [key: string]: string[] } | null> {
    const stored = await this.storageSvc.getItem<{ [key: string]: string[] }>(`${slug}__filters`);
    return stored;
  }

  /**
   * Adds attributes to an array of Phunks
   * @param slug Collection slug
   * @param phunks Array of Phunks to add attributes to
   */
  addAttributes(slug: string | undefined, phunks: Phunk[]): Observable<Phunk[]> {
    if (!phunks.length) return of(phunks);
    if (!slug) return of(phunks);

    return this.getAttributes(slug).pipe(
      map((res: any) => {
        return phunks.map((item: Phunk) => {
          const originalAttributes = item.sha ? res[item.sha] : [];
          if (!originalAttributes) return item;

          const attributes = [...originalAttributes]?.sort((a: Attribute, b: Attribute) => {
            if (a.k === "Sex" || a.k === "Type") return -1;
            if (b.k === "Sex" || b.k === "Type") return 1;
            return 0;
          });

          return { ...item, attributes };
        });
      }),
    );
  }

  ////////////////////////////////////////////////////////
  // OWNED ///////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches Phunks owned by an address
   * @param address Owner address
   * @param slug Collection slug
   */
  fetchOwned(
    address: string,
    slug: string,
  ): Observable<Phunk[]> {
    if (!address) return of([]);
    address = address.toLowerCase();

    const query = supabase.rpc(
      'fetch_ethscriptions_owned_with_listings_and_bids' + this.suffix,
      { address, collection_slug: slug }
    );

    const fetch$ = from(query).pipe(
      map((res: any) => res.data),
      map((res: any[]) => res.map((item: any) => {
        const ethscription = item.ethscription;
        return {
          ...ethscription.phunk,
          listing: ethscription.listing ? ethscription.listing[0] : null,
          bid: ethscription.bid ? ethscription.bid[0] : null,
          isEscrowed:
            ethscription.phunk.owner === environment.marketAddress
            && ethscription.phunk.prevOwner === address,
          isBridged:
            ethscription.phunk.owner === environment.bridgeAddress
            && ethscription.phunk.prevOwner === address,
          attributes: [],
        };
      })),
      switchMap((res: any) => this.addAttributes(slug, res)),
    ) as Observable<Phunk[]>;

    return merge(
      fetch$,
      this.watchEthscriptionsBySlug(slug).pipe(
        switchMap(() => fetch$)
      )
    );
  }

  /**
   * Fetches missed events for an address from a specific block
   * @param address User address
   * @param fromBlock Starting block number
   */
  fetchMissedEvents(address: string, fromBlock: number): Observable<Event[]> {
    address = address.toLowerCase();

    const request = supabase
      .from('events' + this.suffix)
      .select(`
        *,
        ethscriptions${this.suffix}(tokenId,slug)
      `)
      .gte('blockNumber', fromBlock)
      .or(`from.eq.${address},to.eq.${address}`)
      .eq('type', 'PhunkBought');

    return from(request).pipe(
      map(res => res.data as any[]),
      map((res: any[]) => res.map((item: any) => {
        const collection = item[`ethscriptions${this.suffix}`];
        delete item[`ethscriptions${this.suffix}`];
        return {
          ...item,
          ...collection,
        };
      })),
    );
  }

  ////////////////////////////////////////////////////////
  // MARKET DATA /////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches market data for a collection
   * @param slug Collection slug
   */
  fetchMarketData(slug: string): Observable<Phunk[]> {
    if (!slug) return of([]);

    const rpcFetch$ = from(
      supabase.rpc(
        'fetch_ethscriptions_with_listings_and_bids' + this.suffix,
        { collection_slug: slug }
      )
    ).pipe(
      map((res: any) => res.data),
      map((res: any[]) => res.map((item: any) => {
        return {
          ...item.ethscription.ethscription,
          listing: item.ethscription.listing ? item.ethscription.listing[0] : null,
          bid: item.ethscription.bid ? item.ethscription.bid[0] : null,
        }
      })),
      switchMap((res: any) => this.addAttributes(slug, res)),
    ) as Observable<any>;

    return merge(
      rpcFetch$,
      this.watchEthscriptionsBySlug(slug).pipe(
        switchMap(() => rpcFetch$)
      )
    );
  }

  /**
   * Watches for changes to ethscriptions by slug
   * @param slug Collection slug
   */
  private ethscriptionChannels = new Map<string, Observable<void>>();
  private watchEthscriptionsBySlug(slug: string) {
    if (!this.ethscriptionChannels.has(slug)) {
      const channel$ = new Observable<void>((subscriber) => {
        const channel = supabase
          .channel(`ethscriptions_changes__${slug}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ethscriptions' + this.suffix,
              filter: `slug=eq.${slug}`
            },
            (payload: any) => {
              // console.log('watchEthscriptionsBySlug', payload);
              subscriber.next();
            }
          )
          .subscribe();

        return () => {
          channel.unsubscribe();
          this.ethscriptionChannels.delete(slug);
        };
      }).pipe(
        debounceTime(3000),
        share()
      );
      this.ethscriptionChannels.set(slug, channel$);
    }
    return this.ethscriptionChannels.get(slug)!;
  }

  ////////////////////////////////////////////////////////
  // EVENTS //////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches events with optional filters
   * @param limit Number of events to fetch
   * @param type Event type filter
   * @param slug Collection slug filter
   */
  fetchEvents(
    offset: number,
    limit: number,
    type: EventType,
    slug: string,
  ): Observable<Event[]> {
    const query = supabase.rpc(
      'fetch_events' + this.suffix,
      {
        p_limit: limit,
        p_type: type && type !== 'All' ? type : null,
        p_collection_slug: slug,
        p_offset: offset,
      }
    );

    const rpcFetch$ = from(query).pipe(
      map((res: any) => {
        const result = res.data?.map((tx: any) => {
          let type = tx.type;
          if (type === 'transfer') {
            if (tx.to?.toLowerCase() === environment.bridgeAddress) type = 'bridgeOut';
            if (tx.from?.toLowerCase() === environment.bridgeAddress) type = 'bridgeIn';
          }
          return { ...tx, type, } as Event;
        });
        return result;
      }),
    );

    return merge(
      rpcFetch$,
      this.watchEthscriptionsBySlug(slug).pipe(
        switchMap(() => rpcFetch$)
      )
    );
  }

  /**
   * Fetches events for a single token
   * @param hashId Token hash ID
   */
  fetchSingleTokenEvents(hashId: string): Observable<(Event & { [key: string]: string })[]> {
    const response = supabase
      .from('events' + this.suffix)
      .select(`
        *,
        ethscriptions${this.suffix}(tokenId,slug)
      `)
      .eq('hashId', hashId)
      .order('blockTimestamp', { ascending: false });

    return from(response).pipe(
      switchMap((res: any) => {
        if (!res.data.length) return this.fetchUnsupportedTokenEvents(hashId);
        return of(res.data);
      }),
      map((data: any) => {
        return data.map((tx: any) => {
          let type: EventType = tx.type;

          if (tx.type === 'transfer') {
            if (tx.to.toLowerCase() === environment.marketAddress) type = 'escrow';
            if (tx.to.toLowerCase() === environment.bridgeAddress) type = 'bridgeOut';
            if (tx.from.toLowerCase() === environment.bridgeAddress) type = 'bridgeIn';
          }

          return {
            ...tx,
            ...tx[`ethscriptions${this.suffix}`],
            type,
          };
        }) as (Event & { [key: string]: string })[];
      }),
    );
  }

  /**
   * Fetches events for an unsupported token from Ethscriptions API
   * @param hashId Token hash ID
   */
  fetchUnsupportedTokenEvents(hashId: string): Observable<(Event & { [key: string]: string })[]> {
    const prefix = this.suffix.replace('_', '');

    // api-v2.ethscriptions.com
    // sepolia-api.ethscriptions.com
    return this.http.get<any>(`https://${prefix ? (prefix + '-') : ''}api.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
      map((res) => {

        const { valid_transfers } = res;
        // console.log('fetchUnsupportedTokenEvents', valid_transfers);

        const events = valid_transfers
        .sort((a: any, b: any) => a.timestamp > b.timestamp ? -1 : 1)
        .map((tx: any, i: number) => {
          const e: Event = {
            blockHash: tx.block_hash,
            blockNumber: tx.block_number,
            blockTimestamp: new Date(tx.timestamp),
            from: tx.from,
            to: tx.to,
            hashId,
            sha: tx.sha,
            id: tx.id,
            txHash: tx.transaction_hash,
            txId: tx.transaction_hash + '-' + tx.overall_order_number + '-' + tx.transaction_index,
            txIndex: tx.transaction_index,
            type: i === valid_transfers.length - 1 ? 'created' : 'transfer',
            value: tx.sale_price,
          };
          return { ...e, ...tx } as (Event & { [key: string]: string });
        });

        return events;
      }),
    );
  }

  /**
   * Fetches events for a specific user
   * @param address User address
   * @param limit Number of events to fetch
   * @param fromBlock Starting block number
   */
  fetchUserEvents(
    address: string,
    limit: number,
    fromBlock?: number
  ): Observable<any> {

    const query = supabase
    .rpc(
      `fetch_user_events_sepolia`,
      { p_limit: limit, p_address: address.toLowerCase() }
    );

    return from(query).pipe(
      map((res: any) => res.data),
    );
  }

  ////////////////////////////////////////////////////////
  // TOP SALES ///////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches top sales
   * @param limit Number of sales to fetch
   */
  fetchTopSales(limit: number): Observable<any> {
    return of([]);
    // return this.apollo.watchQuery({
    //   query: GET_TOP_SALES,
    //   variables: {
    //     skip: 0,
    //     limit: limit,
    //   },
    //   pollInterval: 5000,
    // }).valueChanges.pipe(
    //   map((result: any) => result.data.events as any[]),
    // );
  }

  ////////////////////////////////////////////////////////
  // PHUNK ///////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Gets hash ID from token ID
   * @param tokenId Token ID
   */
  async getHashIdFromTokenId(slug: string, tokenId: string): Promise<string | null> {
    const query = supabase
      .from('ethscriptions' + this.suffix)
      .select('hashId')
      .eq('slug', slug)
      .eq('tokenId', tokenId);

    const res = await query;
    if (res?.data?.length) return res.data[0]?.hashId;
    return null;
  }

  /**
   * Fetches data for a single Phunk
   * @param hashId Token hash ID
   */
  fetchSinglePhunk(hashId: string): Observable<Phunk> {
    if (!hashId) return of({} as Phunk);

    function formatPhunkFromResponse(data: any, prefix: string) {
      const collection = data[`collections${prefix}`];
      const collectionName = collection?.name;

      const nft = data[`nfts${prefix}`]?.[0];
      if (nft) delete nft?.hashId;

      delete data[`nfts${prefix}`];
      delete data[`collections${prefix}`];

      const newPhunk = { ...data, collection, collectionName, nft } as Phunk;
      newPhunk.isEscrowed = data?.owner === environment.marketAddress;
      newPhunk.isBridged = data?.owner === environment.bridgeAddress;
      newPhunk.isAuctioned = data?.owner === environment.auctionHouseAddress;
      newPhunk.isSupported = !!collection;
      newPhunk.attributes = [];
      return newPhunk;
    }

    let query = supabase
      .from('ethscriptions' + this.suffix)
      .select(`
        *,
        collections${this.suffix}(singleName,slug,name,supply,hasBackgrounds),
        nfts${this.suffix}(hashId,tokenId,owner)
      `)
      .eq('hashId', hashId)
      .limit(1);

    const fetch$ = from(query).pipe(
      switchMap(({ data }: any) => {
        const phunk = data[0];
        if (!phunk) return this.fetchUnsupportedItem(hashId);
        return of(formatPhunkFromResponse(phunk, this.suffix));
      }),
      switchMap((phunk: Phunk) => forkJoin([
        this.addAttributes(phunk.slug, [phunk]),
        from(this.getListingFromHashId(phunk.hashId)),
        this.checkConsensus([phunk]),
      ])),
      map(([[phunk], listing, [consensus]]) => ({
        ...consensus,
        ...phunk,
        listing: listing?.listedBy.toLowerCase() === phunk.prevOwner?.toLowerCase() ? listing : null,
      })),
      tap((phunk) => {
        // console.log('fetchSinglePhunk', phunk);
      }),
    );

    return merge(
      timer(0, 5000).pipe(
        switchMap(() => fetch$),
        takeWhile((phunk) => !phunk?.consensus, true)
      ),
      this.watchSinglePhunk(hashId).pipe(
        switchMap(() => fetch$)
      )
    );
  }

  /**
   * Watches for changes to a single Phunk
   * @param hashId Token hash ID
   */
  private watchSinglePhunk(hashId: string) {
    return new Observable<void>((subscriber) => {
      const channel = supabase
        .channel(`ethscription_changes__${hashId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ethscriptions' + this.suffix,
            filter: `hashId=eq.${hashId}`
          },
          (payload: any) => {
            // console.log('watchSinglePhunk', payload);
            subscriber.next();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    });
  }

  /**
   * Fetches data for an unsupported item
   * @param hashId Token hash ID
   */
  fetchUnsupportedItem(hashId: string): Observable<Phunk> {
    const prefix = this.suffix.replace('_', '');

    const baseUrl = `https://ethscriptions-api${prefix ? ('-' + prefix) : ''}.flooredape.io`;

    return this.http.get<any>(`${baseUrl}/ethscriptions/${hashId}`).pipe(
      map((res: any) => {
        const { result } = res;
        const item: Phunk = {
          slug: '',
          hashId: result.transaction_hash,
          tokenId: result.ethscription_number,
          createdAt: new Date(+result.block_timestamp * 1000),
          owner: result.current_owner,
          prevOwner: result.previous_owner,
          sha: result.content_sha?.replace('0x', ''),
          loading: false,

          imageUri: result.attachment_path ? `${baseUrl}${result.attachment_path}` : result.content_uri,
          creator: result.creator,

          collection: {
            singleName: 'Ethscription',
            name: 'Ethscriptions',
          },
        };

        return item;
      }),
      catchError((err) => {
        return of({
          slug: '',
          hashId,
          tokenId: -1,
          createdAt: new Date(),
          owner: '',
          prevOwner: '',
          sha: '',
          loading: false,
          collection: {
            singleName: 'Ethscription',
            name: 'Ethscriptions',
          }
        } as Phunk);
      }),
    );
  }

  /**
   * Gets listing data for a token
   * @param hashId Token hash ID
   */
  async getListingFromHashId(hashId: string | undefined): Promise<Listing | null> {
    if (!hashId) return null;

    try {
      const [ callL1, callL2 ] = await Promise.all([
        this.web3Svc.readMarketContract('phunksOfferedForSale', [hashId]),
        this.web3Svc.phunksOfferedForSaleL2(hashId),
      ]);

      const offer = callL1[0] ? callL1 : callL2;
      if (!offer?.[0]) return null;

      const listing = {
        createdAt: new Date(),
        hashId: offer[1],
        minValue: offer[3].toString(),
        listedBy: offer[2],
        toAddress: offer[4],
        listed: offer[0],
      };

      return listing;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks consensus status for Phunks
   * @param phunks Array of Phunks to check
   */
  async checkConsensus(phunks: Phunk[]): Promise<Phunk[]> {
    if (!phunks.length) return [];

    const prefix = this.suffix.replace('_', '');

    const hashIds = phunks.map((item: Phunk) => item.hashId);
    let params: any = new HttpParams().set('consensus', 'true');
    for (let i = 0; i < hashIds.length; i++) {
      params = params.append('transaction_hash[]', hashIds[i]);
    }

    const fetchPage = (key?: string): Observable<any> => {
      if (key) {
        params = params.set('page_key', key);
      }
      return this.http.get<any>(`https://ethscriptions-api${prefix ? ('-' + prefix) : ''}.flooredape.io/ethscriptions`, { params });
    };

    return await firstValueFrom(
      fetchPage().pipe(
        expand((res: any) => res.pagination.has_more ? fetchPage(res.pagination.page_key) : EMPTY),
        reduce((acc: any, res) => res ? [...acc, ...res.result] : acc, []),
        map((res: any) => res.map((item: any) => {
          const phunk = phunks.find(p => p.hashId === item.transaction_hash);
          const consensus = !!phunk && phunk.owner === item.current_owner && (phunk.prevOwner === item.previous_owner || !phunk.prevOwner);
          return { ...phunk, consensus };
        })),
        catchError((err) => {
          console.log('checkConsensus', err);
          return of(phunks);
        })
      )
    );
  }

  ////////////////////////////////////////////////////////
  // CHECKS //////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Checks if addresses are holders
   * @param addresses Array of addresses to check
   */
  addressesAreHolders(addresses: string[]): Observable<any> {
    if (!addresses.length) return of([]);

    const query = supabase
      .rpc('addresses_are_holders_sepolia', { addresses });

    return from(query).pipe(
      map((res: any) => res.data),
    );
  }

  /**
   * Checks if an address is banned
   * @param address Address to check
   */
  async checkIsBanned(address: string): Promise<boolean> {
    if (environment.chainId === 1) return false;
    if (!address) return false;

    const { data, error } = await supabase
      .from('buyBans' + this.suffix)
      .select('*')
      .eq('id', address.toLowerCase());

    if (!data) return false;
    return data?.length > 0;
  }

  ////////////////////////////////////////////////////////
  // COLLECTIONS /////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches collections with preview data
   * @param previewLimit Number of preview items per collection
   */
  fetchCollections(onlyDisabled = false): Observable<Collection[]> {
    let params: any = {
      preview_limit: 20,
      show_inactive: onlyDisabled,
    };

    // Initial fetch
    const rpcFetch$: Observable<Collection[]> = from(
      supabase.rpc(
        'fetch_collections_with_previews' + this.suffix,
        params
      )
    ).pipe(
      map((res: any) => {
        if (!res.data) return [];
        return res.data
          .map((item: any) => ({
            ...item.ethscription,
            previews: item.ethscription?.previews || [],
          }))
          .sort((a: Collection, b: Collection) => a.id - b.id)
          .filter((item: Collection) => {
            if (environment.standalone) {
              return item.slug === environment.defaultCollection;
            }
            return true;
          });
      }),
      // tap((res) => console.log('fetchCollections', res)),
    );

    // Realtime changes
    const changes$ = new Observable<Collection[]>(subscriber => {
      const channel = supabase
        .channel('collections_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collections' + this.suffix
          },
          (payload) => {
            subscriber.next(payload.new as Collection[]);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }).pipe(switchMap(() => rpcFetch$));

    return merge(rpcFetch$, changes$);
  }

  /**
   * Fetches disabled collections
   */
  fetchDisabledCollections(): Observable<any[]> {
    return this.fetchCollections(true);
  }

  /**
   * Fetches stats for a collection
   * @param slug Collection slug
   * @param days Number of days to fetch stats for
   */
  fetchStats(slug: string, days: number = 1000): Observable<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = supabase
      .rpc(
        `get_total_volume${this.suffix}`,
        { start_date: startDate, end_date: endDate, slug_filter: slug }
      );

    const queryTopSales = supabase
      .rpc(
        `fetch_top_sales${this.suffix}`,
        { p_slug: slug, p_limit: 100 }
      );

    return forkJoin([from(query), from(queryTopSales)]).pipe(
      map(([res, topSales]) => ({
        totalVolume: res.data[0],
        topSales: topSales.data,
      })),
      // tap((res) => console.log('fetchStats', res)),
    );
  }

  /**
   * Fetches paginated data with filters
   * @param slug Collection slug
   * @param fromNum Starting number
   * @param toNum Ending number
   * @param filters Optional filters
   */
  fetchAllWithPagination(
    slug: string,
    fromNum: number,
    toNum: number,
    filters?: any,
  ): Observable<MarketState['activeMarketRouteData']> {

    return from(
      supabase.rpc(`fetch_all_with_pagination_new${this.suffix}`, {
        p_slug: slug,
        p_from_num: fromNum,
        p_to_num: toNum,
        p_filters: filters,
      })
    ).pipe(
      switchMap((res: any) => {
        if (res.error) throw res.error;
        return this.getAttributes(slug).pipe(
          map((attributes) => {
            const data = res.data;
            return {
              data: data.data.map((item: Phunk) => ({
                ...item,
                attributes: attributes?.[item.sha] || [],
              } as Phunk)),
              total: data.total_count
            }
          }),
        )
      }),
      catchError((err) => {
        return of({ data: [], total: 0 });
      })
    );
  }

  /**
   * Fetches mint progress for a collection
   * @param slug Collection slug
   */
  fetchMintProgress(slug: string): Observable<number> {
    if (!slug) return of(0);

    const query = supabase
      .from('ethscriptions' + this.suffix)
      .select('*', { count: 'exact', head: true })
      .eq('slug', slug);

    const fetch$ = from(query).pipe(
      // tap((res: any) => console.log('fetchMintProgress', res)),
      map((res: any) => res.count || 0),
    );

    return merge(
      fetch$,
      this.watchEthscriptionsBySlug(slug).pipe(
        switchMap(() => fetch$)
      )
    );
  }

  ////////////////////////////////////////////////////////
  // AUCTIONS ////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  async fetchAuctionByHashId(hashId: string): Promise<Auction | null> {
    const query = supabase
      .from('auctions' + this.suffix)
      .select('*')
      .eq('hashId', hashId)
      .eq('settled', false)
      .limit(1);

    const { data, error } = await query;
    if (error || !data?.length) return null;
    return data[0];
  }

  auctionChannels = new Map<number, Observable<any>>();
  watchAuctionBids(auctionId: number): Observable<any[]> {
    if (!auctionId) return of([]);

    if (this.auctionChannels.has(auctionId)) {
      return this.auctionChannels.get(auctionId)!;
    }

    const channel$ = new Observable<void>((subscriber) => {
      const channel = supabase
        .channel(`auctionBids_changes__${auctionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctionBids' + this.suffix, filter: `auctionId=eq.${auctionId}` }, (payload) => {
          subscriber.next();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
        this.auctionChannels.delete(auctionId);
      };
    }).pipe(
      share()
    );

    const watchStream$ = merge(
      this.fetchAuctionBids(auctionId),
      channel$.pipe(
        switchMap(() => this.fetchAuctionBids(auctionId))
      )
    );

    this.auctionChannels.set(auctionId, watchStream$);
    return watchStream$;
  }

  private fetchAuctionBids(auctionId: number): Observable<any[]> {
    if (!auctionId) return of([]);

    const query = supabase
      .from('auctionBids' + this.suffix)
      .select('*')
      .eq('auctionId', auctionId);

    return from(query).pipe(
      map((res: any) => res.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    );
  }

  ////////////////////////////////////////////////////////
  // USD /////////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches current USD price of ETH
   */
  fetchUSDPrice(): Observable<number> {
    return this.http.get('https://min-api.cryptocompare.com/data/price', {
      params: {
        fsym: 'ETH',
        tsyms: 'USD'
      }
    }).pipe(
      map((res: any) => res?.USD || 0)
    );
  }

  /**
   * Fetches merkle proofs for a token
   * @param hashId Token hash ID
   */
  fetchProofs(hashId: string): Observable<any> {
    return this.http.get(`http://localhost:3000/merkle-proofs`, {
      params: {
        leaf: hashId
      },
      responseType: 'text'
    });
  }

  /**
   * Fetches leaderboard data
   */
  fetchLeaderboard(): Observable<any> {
    return from(from(supabase.rpc('fetch_leaderboard' + this.suffix))).pipe(
      map((res: any) => res.data),
    );
  }

  ////////////////////////////////////////////////////////
  // COMMENTS ////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  /**
   * Fetches comments for a given topic
   * @param rootTopic Topic to fetch comments for
   */
  async fetchComments(rootTopic: string): Promise<CommentWithReplies[]> {
    if (!rootTopic) return [];

    // Helper function to fetch comments for a given topic
    const fetchReplies = async (topic: string): Promise<CommentWithReplies[]> => {
      const { data, error } = await supabase
        .from('comments' + this.suffix)
        .select('*')
        .eq('topic', topic.toLowerCase())
        // .eq('deleted', false)
        .order('createdAt', { ascending: false });

      if (error || !data) return [];

      // For each comment, recursively fetch its replies
      const commentsWithReplies = await Promise.all(
        data.map(async (comment) => {
          const replies = await fetchReplies(comment.id);
          return {
            ...comment,
            replies: replies.length > 0 ? replies : undefined
          };
        })
      );

      return commentsWithReplies;
    };

    // Start fetching from the root topic
    return await fetchReplies(rootTopic.toLowerCase());
  }

  /**
   * Fetches comment changes for a given topic
   * @param topics Array of topics to fetch changes for
   */
  getCommentChanges(topics: string[]): Observable<void> {
    // console.log('getCommentChanges', topics);
    const table = 'comments' + this.suffix;

    const isInserted = (payload: RealtimePostgresInsertPayload<{
      [key: string]: any;
    }>, topics: string[]) => {
      const topic = payload.new.topic || payload.new.id;
      return topics.includes(topic);
    };

    const isUpdated = (payload: RealtimePostgresUpdatePayload<{
      [key: string]: any;
    }>, topics: string[]) => {
      const topic = payload.new.topic || payload.new.id;
      return topics.includes(topic);
    };

    return new Observable(subscriber => {
      const subscription = supabase
        .channel('comments')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table },
          (payload) => {
            if (isInserted(payload, topics)) subscriber.next();
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table },
          (payload) => {
            if (isUpdated(payload, topics)) subscriber.next();
          }
        )
        .subscribe();

      return () => subscription.unsubscribe();
    });
  }

  /**
   * Fetches user avatar for a given address
   * @param address User address
   */
  async getUserAvatar(address: string): Promise<string> {
    const { data, error } = await supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('owner', address.toLowerCase())
      .limit(1);

    if (error) return '';
    return data[0]?.sha || '';
  }
}
