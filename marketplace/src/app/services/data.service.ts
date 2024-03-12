import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';

import { filterData } from '@/constants/filterData';

import { EventType, GlobalState } from '@/models/global-state';
import { Attribute, Bid, Event, Listing, Phunk } from '@/models/db';

import { createClient } from '@supabase/supabase-js'

import { Observable, of, BehaviorSubject, from, forkJoin, firstValueFrom, EMPTY } from 'rxjs';
import { catchError, expand, map, reduce, switchMap, tap } from 'rxjs/operators';

import { NgForage } from 'ngforage';

import { environment } from 'src/environments/environment';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as appStateActions from '@/state/actions/app-state.actions';

import { MarketState } from '@/models/market.state';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);

@Injectable({
  providedIn: 'root'
})

export class DataService {

  public prefix: string = environment.chainId === 1 ? '' : '_sepolia';

  staticUrl = environment.staticUrl;
  escrowAddress = environment.marketAddress;

  private eventsData = new BehaviorSubject<Event[]>([]);
  eventsData$ = this.eventsData.asObservable();

  private currentFloor = new BehaviorSubject<number>(0);
  currentFloor$ = this.currentFloor.asObservable();

  filterData = filterData;

  attributes!: any;

  walletAddress$ = this.store.select(state => state.appState.walletAddress);

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    private web3Svc: Web3Service,
    private ngForage: NgForage,
  ) {

    this.createListeners();
    this.fetchUSDPrice();

    // this.fetchStats(90, undefined).subscribe((res: any) => {
    //   console.log('fetchStats', res);
    // });

    // this.fetchUserEvents(
    //   '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7',
    //   10,
    //   0
    // ).subscribe((res: any) => {
    //   console.log('fetchUserEvents', res);
    // });
  }

  createListeners() {
    supabase
      .channel('events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' + this.prefix },
        (payload) => {
          if (!payload) return;
          this.store.dispatch(dataStateActions.dbEventTriggered({ payload }));
        },
      ).subscribe();

    supabase
      .channel('users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' + this.prefix },
        (payload) => {
          this.store.dispatch(dataStateActions.fetchLeaderboard());

          const newData = payload.new as any;
          const address = newData.address;
          this.store.dispatch(appStateActions.fetchUserPoints({ address }));
        },
      ).subscribe();

    this.listenForBlocks();
  }

  listenForBlocks() {
    supabase
      .channel('blocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocks' },
        (payload: any) => {
          if (payload.new.network !== environment.chainId) return;
          this.store.dispatch(appStateActions.setIndexerBlock({ indexerBlock: payload.new.blockNumber }));
        },
      ).subscribe();

    supabase
      .from('blocks')
      .select('blockNumber')
      .eq('network', environment.chainId)
      .then((res: any) => {
        const blockNumber = res.data[0]?.blockNumber || 0;
        this.store.dispatch(appStateActions.setIndexerBlock({ indexerBlock: blockNumber }));
      })
  }

  getFloor(): number {
    return this.currentFloor.getValue();
  }

  getAttributes(slug: string): Observable<any> {
    return from(this.ngForage.getItem(`${slug}__attributes`)).pipe(
      switchMap((res: any) => {
        if (res) return of(res);
        return this.http.get(`${environment.staticUrl}/data/${slug}_attributes.json`).pipe(
          tap((res: any) => this.ngForage.setItem(`${slug}__attributes`, res)),
        );
      }),
    );
  }

  addAttributes(slug: string | undefined, phunks: Phunk[]): Observable<Phunk[]> {
    if (!phunks.length) return of(phunks);
    if (!slug) return of(phunks);

    return this.getAttributes(slug).pipe(
      map((res: any) => {
        return phunks.map((item: Phunk) => ({
          ...item,
          attributes: item.sha ? res[item.sha] : [],
        }));
      }),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // COLLECTION ////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchMultipleByHashId(hashIds: Phunk['hashId'][]): Observable<any> {
    const query = supabase
      .from('ethscriptions' + this.prefix)
      .select(`
        *,
        listings${this.prefix}(minValue)
      `)
      .in('hashId', hashIds)
      .limit(1000);

    return from(query).pipe(map((res: any) => {
      return res.data.map((item: any) => {
        const listing = item[`listings${this.prefix}`];
        delete item[`listings${this.prefix}`];
        return {
          ...item,
          listing,
        };
      });
    }));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // OWNED /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchOwned(
    address: string,
    slug: string | undefined,
  ): Observable<Phunk[]> {
    // console.log('fetchOwned', {address, slug});

    if (!address) return of([]);
    address = address.toLowerCase();

    const query = supabase.rpc(
      'fetch_ethscriptions_owned_with_listings_and_bids' + this.prefix,
      { address, collection_slug: slug }
    );
    return from(query).pipe(
      // tap((res) => console.log('fetchOwned', res)),
      map((res: any) => res.data),
      map((res: any[]) => res.map((item: any) => {
        const ethscription = item.ethscription;
        // console.log('fetchOwned', ethscription);
        return {
          ...ethscription.phunk,
          listing: ethscription.listing ? ethscription.listing[0] : null,
          bid: ethscription.bid ? ethscription.bid[0] : null,
          isEscrowed:
            ethscription.phunk.owner === environment.marketAddress
            && ethscription.phunk.prevOwner === address,
          attributes: [],
        };
      })),
      switchMap((res: any) => this.addAttributes(slug, res)),
    ) as Observable<Phunk[]>;
  }

  fetchMissedEvents(address: string, lastBlock: number): Observable<Event[]> {
    address = address.toLowerCase();

    const request = supabase
      .from('events' + this.prefix)
      .select(`
        *,
        ethscriptions${this.prefix}(tokenId,slug)
      `)
      .gt('blockNumber', lastBlock)
      .or(`from.eq.${address},to.eq.${address}`)
      .eq('type', 'PhunkBought');

    return from(request).pipe(
      map(res => res.data as any[]),
      map((res: any[]) => res.map((item: any) => {
        const collection = item[`ethscriptions${this.prefix}`];
        delete item[`ethscriptions${this.prefix}`];
        return {
          ...item,
          ...collection,
        };
      })),
      // tap((res) => console.log('fetchMissedEvents', res[0])),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // MARKET DATA ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchMarketData(slug: string): Observable<Phunk[]> {
    if (!slug) return of([]);
    return from(
      supabase.rpc(
        'fetch_ethscriptions_with_listings_and_bids' + this.prefix,
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
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // EVENTS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchEvents(
    limit: number,
    type?: EventType,
    slug?: string,
  ): Observable<any> {
    return from(supabase.rpc('fetch_events' + this.prefix, {
      p_limit: limit,
      p_type: type && type !== 'All' ? type : null,
      p_collection_slug: slug
    })).pipe(
      // tap((res) => console.log('fetchEvents', res)),
      map((res: any) => res.data),
    );
  }

  fetchSingleTokenEvents(hashId: string): Observable<any> {
    const response = supabase
      .from('events' + this.prefix)
      .select(`
        *,
        ethscriptions${this.prefix}(tokenId,slug)
      `)
      .eq('hashId', hashId)
      .order('blockTimestamp', { ascending: false });

    return from(response).pipe(
      map((res: any) => {
        return res.data.map((item: any) => {
          return {
            ...item,
            ...item[`ethscriptions${this.prefix}`],
          };
        });
      }),
      // tap((res) => console.log('fetchSingleTokenEvents', res)),
    );
  }

  fetchUserEvents(
    address: string,
    limit: number,
    fromBlock?: number
  ): Observable<any> {

    const query = supabase
      .from('events' + this.prefix)
      .select('*')
      .or(`from.eq.${address.toLowerCase()},to.eq.${address.toLowerCase()}`)
      .order('blockNumber', { ascending: false })
      .limit(limit);

    if (fromBlock) query.gt('blockNumber', fromBlock);

    return from(query).pipe(
      map((res: any) => res.data),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // TOP SALES /////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // SINGLE PHUNK //////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchSinglePhunk(tokenId: string): Observable<any> {

    let query = supabase
      .from('ethscriptions' + this.prefix)
      .select(`
        hashId,
        sha,
        tokenId,
        createdAt,
        owner,
        prevOwner,
        collections${this.prefix}(singleName,slug,name,supply)
      `)
      .limit(1);

    if (tokenId.startsWith('0x')) query = query.eq('hashId', tokenId);
    else query = query.eq('tokenId', tokenId);

    return from(query).pipe(
      map((res: any) => (res.data?.length ? res.data[0] : { tokenId })),
      map((phunk: any) => {
        let collection = phunk[`collections${this.prefix}`];
        let collectionName = collection?.name;
        delete phunk[`collections${this.prefix}`];

        const newPhunk = { ...phunk, ...collection, collectionName } as Phunk;
        newPhunk.isEscrowed = phunk?.owner === environment.marketAddress;
        newPhunk.attributes = [];

        return newPhunk;
      }),
      switchMap((res: Phunk) => forkJoin([
        this.addAttributes(res.slug, [res]),
        from(this.getListingFromHashId(res.hashId))
      ])),
      map(([[res], listing]) => {
        // console.log({res, listing})
        return {
          ...res,
          listing: listing?.listedBy.toLowerCase() === res.prevOwner?.toLowerCase() ? listing : null,
          attributes: [ ...(res.attributes || []) ].sort((a: Attribute, b: Attribute) => {
            if (a.k === "Sex") return -1;
            if (b.k === "Sex") return 1;
            return 0;
          }),
        };
      }),
      // tap((res) => console.log('fetchSinglePhunk', res)),
    );
  }

  async getListingFromHashId(hashId: string | undefined): Promise<Listing | null> {
    if (!hashId) return null;

    try {
      const call = await this.web3Svc.readMarketContract('phunksOfferedForSale', [hashId]);
      if (!call[0]) return null;

      return {
        createdAt: new Date(),
        hashId: call[1],
        minValue: call[3].toString(),
        listedBy: call[2],
        toAddress: call[4],
        listed: call[0],
      };
    } catch (error) {
      console.log('getListingFromHashId', error);
      return null;
    }
  }

  async getBidFromHashId(hashId: string | undefined): Promise<Bid | null> {
    if (!hashId) return null;

    try {
      const call = await this.web3Svc.readMarketContract('phunkBids', [hashId]);
      if (!call[0]) return null;

      return {
        createdAt: new Date(),
        hashId: call[1],
        value: call[3].toString(),
        fromAddress: call[2],
      };
    } catch (error) {
      console.log('getBidFromHashId', error);
      return null;
    }
  }

  async checkConsensus(phunks: Phunk[]): Promise<Phunk[]> {
    if (!phunks.length) return [];

    const prefix = this.prefix.replace('_', '');

    const hashIds = phunks.map((item: Phunk) => item.hashId);
    let params: any = new HttpParams().set('consensus', 'true');
    for (let i = 0; i < hashIds.length; i++) {
      params = params.append('transaction_hash[]', hashIds[i]);
    }

    const fetchPage = (key?: string): Observable<any> => {
      if (key) {
        params = params.set('page_key', key);
      }
      return this.http.get<any>(`https://ethscriptions-api-${prefix}.flooredape.io/ethscriptions`, { params }).pipe(
        tap((res: any) => { if (res) console.log('checkConsensus', res); }),
      );
    };

    return await firstValueFrom(
      fetchPage().pipe(
        // Use expand to recursively call fetchPage until there's no more data
        expand((res: any) => res.pagination.has_more ? fetchPage(res.pagination.page_key) : EMPTY),
        reduce((acc: any, res) => res ? [...acc, ...res.result] : acc, []),
        // Map the final result to your structure
        map((res: any) => res.map((item: any) => {
          const phunk = phunks.find(p => p.hashId === item.transaction_hash);
          const consensus = !!phunk && phunk.owner === item.current_owner && (phunk.prevOwner === item.previous_owner || !phunk.prevOwner);
          return { ...phunk, consensus };
        }))
      )
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CHECKS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  addressesAreHolders(addresses: string[]): Observable<any> {
    if (!addresses.length) return of([]);

    const query = supabase
      .rpc('addresses_are_holders_sepolia', { addresses });

    return from(query).pipe(
      // tap((res) => console.log(res)),
      map((res: any) => res.data),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // COLLECTIONS ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchCollections(): Observable<any[]> {
    const query = supabase
      .from('collections' + this.prefix)
      .select('*')
      .order('id', { ascending: false })
      .eq('active', true);

    return from(query).pipe(map((res: any) => res.data));
  }

  fetchCollectionsWithAssets(limit: number = 10): Observable<any[]> {
    const query = supabase
      .rpc(
        'fetch_collections_with_previews' + this.prefix,
        { preview_limit: limit }
      );

    return from(query).pipe(
      map((res: any) => res.data.map((item: any) => ({ ...item.ethscription }))),
    );
  }

  fetchStats(
    days: number = 1,
    slug?: string
  ): Observable<any> {

    const query = supabase
      .rpc('get_total_volume', {
        start_date: new Date(new Date().getTime() - ((1000 * 60 * 60 * 24) * days)),
        end_date: new Date(),
        slug_filter: slug,
      });

    return from(query).pipe(
      map((res: any) => res.data[0]),
    )
  }

  fetchAllWithPagination(
    slug: string = 'ethereum-phunks',
    fromNum: number,
    toNum: number,
    filters?: any,
  ): Observable<MarketState['activeMarketRouteData']> {

    return from(
      supabase.rpc(`fetch_all_with_pagination${this.prefix}`, {
        p_slug: slug,
        p_from_num: fromNum,
        p_to_num: toNum,
        p_filters: filters,
      })
    ).pipe(
      // tap((res) => console.log('fetchAllWithPagination', {slug, fromNum, toNum, filters, res})),
      switchMap((res: any) => {
        if (res.error) throw res.error;
        return this.getAttributes(slug).pipe(
          map((attributes) => {
            const data = res.data;
            return {
              data: data.data.map((item: Phunk) => ({
                ...item,
                attributes: attributes[item.sha],
              } as Phunk)),
              total: data.total_count
            }
          }),
        )
      }),
      catchError((err) => {
        // console.log('fetchAllWithPagination', err);
        return of({ data: [], total: 0 });
      })
    );

  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // AUCTIONS //////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // async fetchAuctions(hashId: string): Promise<any> {
  //   let query = supabase
  //     .from('auctions' + this.prefix)
  //     .select('*')
  //     .eq('hashId', hashId)


  //   return from(query).pipe(map((res: any) => {
  //     console.log('fetchSinglePhunk', res);
  //     return res.data[0] || { phunkId };
  //   }));
  // }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // USD ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchUSDPrice() {
    this.http.get('https://min-api.cryptocompare.com/data/price', {
      params: {
        fsym: 'ETH',
        tsyms: 'USD'
      }
    }).pipe(
      map((res: any) => res?.USD || 0),
      tap((res) => this.store.dispatch(dataStateActions.setUsd({ usd: res }))),
    ).subscribe();
  }

  fetchProofs(hashId: string): Observable<any> {
    return this.http.get(`http://localhost:3000/merkle-proofs`, {
      params: {
        leaf: hashId
      },
      responseType: 'text'
    });
  }

  fetchLeaderboard(): Observable<any> {
    return from(from(supabase.rpc('fetch_leaderboard' + this.prefix))).pipe(
      map((res: any) => res.data),
    );
  }
}
