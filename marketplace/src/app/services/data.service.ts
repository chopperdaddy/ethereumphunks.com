import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';

import { filterData } from '@/constants/filterData';

import { EventType, GlobalState } from '@/models/global-state';
import { Attribute, Bid, Event, Listing, Phunk } from '@/models/db';

import { createClient } from '@supabase/supabase-js'

import { Observable, of, BehaviorSubject, from, forkJoin, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';

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

  public prefix: string = environment.chainId === 1 ? '' : '_goerli';

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
    this.fetchUSDPrice();

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
          this.store.dispatch(appStateActions.fetchUserPoints());
        },
      ).subscribe();

    supabase
      .channel('blocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocks' },
        (payload: any) => {
          this.store.dispatch(appStateActions.setIndexerBlock({ indexerBlock: payload.new.blockNumber }));
        },
      ).subscribe();

    // this.fetchAllWithPagination( 'ethereum-phunks', 0, 10, { "hair": "blonde-bob" }).subscribe((res) => {
    //   console.log('fetchAllWithPagination', res);
    // });

    // this.fetchStats(90, undefined).subscribe((res: any) => {
    //   console.log('fetchStats', res);
    // });
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
  // OWNED /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchOwned(
    address: string,
    slug: string | undefined,
  ): Observable<Phunk[]> {
    // console.log('fetchOwned', {address, slug});

    if (!address) return of([]);
    address = address.toLowerCase();

    const qurey = supabase.rpc(
      'fetch_ethscriptions_owned_with_listings_and_bids' + this.prefix,
      { address, collection_slug: slug }
    );
    return from(qurey).pipe(
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
      map((res: any) => {
        return res.data ? res.data[0] : { tokenId };
      }),
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
        from(Promise.all([
          this.getListingFromHashId(res.hashId),
          this.getBidFromHashId(res.hashId),
        ]))
      ])),
      map(([[res], [listing, bid]]) => {
        return {
          ...res,
          listing: listing?.listedBy.toLowerCase() === res.prevOwner?.toLowerCase() ? listing : null,
          bid,
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
      const call = await this.web3Svc.readContract('phunksOfferedForSale', [hashId]);
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
      const call = await this.web3Svc.readContract('phunkBids', [hashId]);
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

  async checkConsensus(
    hashId: string,
    owner: string,
    prevOwner: string | null,
  ): Promise<boolean> {
    if (!hashId || !owner) return false;
    return await firstValueFrom(
      this.http.get(`https://${this.prefix ? (this.prefix.replace('_', '') + '-') : ''}api.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
        // tap((res: any) => console.log('checkConsensus', res)),
        map((res: any) => {
          if (!res) return false;
          if (res.current_owner.toLowerCase() !== owner.toLowerCase()) return false;
          return true;
        }),
      )
    )
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CHECKS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // phunksCanTransfer(hashIds: Phunk['hashId'][]): Observable<any> {
  //   return this.walletAddress$.pipe(
  //     switchMap((address) => {
  //       const query = supabase
  //         .from('ethscriptions' + this.prefix)
  //         .select('*')
  //         .in('hashId', hashIds)
  //         .eq('owner', address)
  //         .limit(1000);

  //       return from(query).pipe(map((res: any) => res.data));
  //     }),
  //   );
  // }

  phunksAreInEscrow(hashIds: Phunk['hashId'][], checkPrevOwner = true): Observable<any> {
    return this.walletAddress$.pipe(
      switchMap((address) => {
        const query = supabase
          .from('ethscriptions' + this.prefix)
          .select(`
            *,
            listings${this.prefix}(minValue)
          `)
          .in('hashId', hashIds)
          .eq('owner', this.escrowAddress)
          .limit(1000);

        if (checkPrevOwner) query.eq('prevOwner', address);

        return from(query).pipe(map((res: any) => {
          // console.log('phunksAreInEscrow', { res, address, hashIds });
          return res.data.map((item: any) => {
            // console.log(item)
            const listing = item[`listings${this.prefix}`];
            delete item[`listings${this.prefix}`];
            return {
              ...item,
              listing,
            };
          });
        }));
      }),
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

  // fetchAll(
  //   slug: string,
  //   fromNum: number,
  //   toNum: number,
  //   filters?: any,
  // ): Observable<Phunk[]> {
  //   console.log('fetchAll', { slug, fromNum, toNum, filters });
  //   // console.log('fetchAll', { slug, fromNum, toNum, filters });

  //   let query = supabase
  //     .from('ethscriptions')
  //     .select(`
  //       tokenId,
  //       slug,
  //       hashId,
  //       sha,
  //       attributes!inner()
  //     `)
  //     .eq('slug', slug)
  //     .order('tokenId', { ascending: true })
  //     .range(fromNum, toNum);

  //   if (Object.keys(filters).length) {
  //     Object.keys(filters).forEach(key => {
  //       const value = filters[key];
  //       query = query.ilike(`attributes.values->>${key}`, `%${value}%`);
  //     });
  //   }

  //   return from(query).pipe(
  //     // tap((res) => console.log('fetchAll', res)),
  //     switchMap((res) => {
  //       return this.getAttributes(slug).pipe(
  //         map((attributes) => {
  //           if (!res.data) return [];
  //           return res.data?.map((item: any) => {
  //             const ethscription = item[`ethscriptions${this.prefix}`];
  //             delete item[`ethscriptions${this.prefix}`];
  //             return {
  //               ...item,
  //               ...ethscription,
  //               attributes: attributes[item.sha],
  //             } as Phunk;
  //           })
  //         })
  //       )
  //     }),
  //   );
  // }

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
      supabase.rpc('fetch_all_with_pagination', {
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
        console.log('fetchAllWithPagination', err);
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
