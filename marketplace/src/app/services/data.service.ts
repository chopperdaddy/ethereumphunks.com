import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';

import { filterData } from '@/constants/filterData';

import { EventType, GlobalState } from '@/models/global-state';
import { Bid, Event, Listing, Phunk } from '@/models/db';

import { createClient } from '@supabase/supabase-js'
import { Observable, of, BehaviorSubject, from, forkJoin } from 'rxjs';
import { concatMap, map, switchMap, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

import * as dataStateActions from '@/state/actions/data-state.actions';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);

const marketAddress = environment.marketAddress;
const pointsAddress = environment.pointsAddress;
const auctionAddress = environment.auctionAddress;
const donationsAddress = environment.donationsAddress;

@Injectable({
  providedIn: 'root'
})

export class DataService {

  public prefix: string = environment.chainId === 1 ? '_mainnet' : '_goerli';

  staticUrl = environment.staticUrl;
  escrowAddress = environment.marketAddress;

  private attributesData!: any;

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
    private web3Svc: Web3Service
  ) {
    this.fetchUSDPrice();

    supabase
      .channel('any')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' + this.prefix },
        (payload) => {
          if (!payload) return;
          this.store.dispatch(dataStateActions.dbEventTriggered({ payload }));
        },
      ).subscribe();
  }

  getFloor(): number {
    return this.currentFloor.getValue();
  }

  getAttributes(): Observable<any> {
    if (this.attributesData) return of(this.attributesData);
    return this.http.get(`${environment.staticUrl}/_attributes.json`).pipe(
      tap((res) => this.attributesData = res)
    );
  }

  addAttributes(phunks: Phunk[]): Observable<Phunk[]> {
    if (!phunks.length) return of(phunks);
    return this.getAttributes().pipe(
      map((res: any) => {
        return phunks.map((item: Phunk) => ({
          ...item,
          attributes: res[item.tokenId]
        }));
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // OWNED /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchOwned(address: string): Observable<any[]> {
    address = address.toLowerCase();

    const qurey = supabase.rpc('fetch_phunks_owned_with_listings_and_bids', { address });
    return from(qurey).pipe(
      // tap((res) => console.log('fetchOwned', res)),
      map((res: any) => res.data),
      map((res: any[]) => res.map((item: any) => {
        const phunk = item.phunk.phunk;
        return {
          ...phunk,
          listing: item.phunk.listing ? item.phunk.listing[0] : null,
          bid: item.phunk.bid ? item.phunk.bid[0] : null,
          isEscrowed: phunk.owner === environment.marketAddress && phunk.prevOwner === address,
          attributes: [],
        }
      })),
      switchMap((res: any) => this.addAttributes(res)),
    ) as Observable<any>;
  }

  fetchUserOpenBids(address: string): Observable<any[]> {
    address = address.toLowerCase();
    const request = supabase
      .from('bids' + this.prefix)
      .select(`*, ethscriptions${this.prefix}(tokenId)`)
      .eq('fromAddress', address)
      .order('value', { ascending: false });

    return from(request).pipe(
      // tap((res) => console.log('fetchUserOpenBids', res)),
      map((res) => res.data as any[]),
      map((res: any) => res.map((item: any) => {
        return {
          ...item[`phunks${this.prefix}`],
          bid: {
            createdAt: item.createdAt,
            hashId: item.hashId,
            fromAddress: item.fromAddress,
            value: item.value,
            txHash: item.txHash,
          },
          attributes: [],
        };
      })),
    );
  }

  fetchMissedEvents(address: string, lastBlock: number): Observable<Event[]> {
    address = address.toLowerCase();

    const request = supabase
      .from('events' + this.prefix)
      .select('*')
      .gt('blockNumber', lastBlock)
      .or(`from.eq.${address},to.eq.${address}`)
      .eq('type', 'PhunkBought');

    return from(request).pipe(map(res => res.data as any[]));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // MARKET DATA ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchMarketData(limit: number = 1500): Observable<Phunk[]> {
    return from(
      supabase.rpc(
        'fetch_ethscriptions_with_listings_and_bids',
        { collection_slug: 'ethereum-phunks' }
      ).limit(limit)
    ).pipe(
      map((res: any) => res.data),
      map((res: any[]) => res.map((item: any) => {
        return {
          ...item.ethscription.ethscription,
          listing: item.ethscription.listing ? item.ethscription.listing[0] : null,
          bid: item.ethscription.bid ? item.ethscription.bid[0] : null,
        }
      })),
      tap((res) => console.log('fetchMarketData', res)),
      switchMap((res: any) => this.addAttributes(res)),
    ) as Observable<any>;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // EVENTS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchEvents(limit: number, type?: EventType): Observable<any> {
    return from(supabase.rpc('fetch_events', {
      p_limit: limit,
      p_type: type && type !== 'All' ? type : null
    })).pipe(
      // tap((res) => console.log('fetchEvents', res)),
      map((res: any) => res.data.map((item: any) => ({
        ...item,
        // blockTimestamp: new Date(item.blockTimestamp).getTime(),
      }))),
    );
  }

  fetchSingleTokenEvents(hashId: string): Observable<any> {
    const response = supabase
      .from('events' + this.prefix)
      .select('*')
      .eq('hashId', hashId)
      .order('blockTimestamp', { ascending: false });

    return from(response).pipe(
      // tap((res) => console.log('fetchSingleTokenEvents', res)),
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
      // .select(`
      //   hashId,
      //   phunkId,
      //   createdAt,
      //   owner,
      //   prevOwner,
      //   auctions${this.prefix}(
      //     hashId,
      //     settled,
      //     bidder,
      //     startTime,
      //     endTime,
      //     amount,
      //     prevOwner
      //   )
      // `)
      .select(`
        hashId,
        tokenId,
        createdAt,
        owner,
        prevOwner
      `)
      .limit(1);

    if (tokenId.startsWith('0x')) query = query.eq('hashId', tokenId);
    else query = query.eq('tokenId', tokenId);

    return from(query).pipe(
      map((res: any) => {
        return res.data ? res.data[0] : { tokenId };
      })
    );
  }

  async getListingFromHashId(hashId: string | undefined): Promise<Listing | null> {
    if (!hashId) return null;

    const call = await this.web3Svc.readContract('phunksOfferedForSale', [hashId]);
    if (!call[0]) return null;

    return {
      createdAt: new Date(),
      hashId: call[1],
      minValue: call[3],
      listedBy: call[2],
      toAddress: call[4],
      listed: call[0],
    };
  }

  async getBidFromHashId(hashId: string | undefined): Promise<Bid | null> {
    if (!hashId) return null;

    const call = await this.web3Svc.readContract('phunkBids', [hashId]);
    if (!call[0]) return null;

    return {
      createdAt: new Date(),
      hashId: call[1],
      value: call[3],
      fromAddress: call[2],
    };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CHECKS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  phunksCanTransfer(hashIds: Phunk['hashId'][]): Observable<any> {
    return this.walletAddress$.pipe(
      switchMap((address) => {
        const query = supabase
          .from('ethscriptions' + this.prefix)
          .select()
          .in('hashId', hashIds)
          .eq('owner', address)
          .limit(1000);

        return from(query).pipe(map((res: any) => res.data));
      }),
    );
  }

  phunksAreInEscrow(hashIds: Phunk['hashId'][]): Observable<any> {
    return this.walletAddress$.pipe(
      switchMap((address) => {
        const query = supabase
          .from('ethscriptions' + this.prefix)
          .select()
          .in('hashId', hashIds)
          .eq('prevOwner', address)
          .eq('owner', this.escrowAddress)
          .limit(1000);

        return from(query).pipe(map((res: any) => res.data));
      }),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // COLLECTIONS ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchCollections(): Observable<any[]> {
    const query = supabase
      .from('collections' + this.prefix)
      .select(`*, ethscriptions${this.prefix}(*)`)
      .order('id', { ascending: false })
      .limit(12, { referencedTable: `ethscriptions${this.prefix}` });

    return from(query).pipe(map((res: any) => res.data)).pipe(
      switchMap((res: any) => {
        return forkJoin(
          res.map((coll: any) => {
            return from(
              supabase.rpc(
                'get_lowest_price_ethscription_by_collection',
                { collection_slugs: [coll.slug] }
              )
            ).pipe(
              map((res) => ({
                ...coll,
                lowestPrice: res.data[0]?.minValue,
              }))
            );
          })
        );
      }),
      tap((res) => console.log('fetchCollections', res)),
      map((res: any) => res),
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
    return from(from(supabase.rpc('fetch_leaderboard'))).pipe(
      map((res: any) => res.data),
    );
  }
}
