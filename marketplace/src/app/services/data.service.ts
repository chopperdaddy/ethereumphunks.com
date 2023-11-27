import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';

import { filterData } from '@/constants/filterData';

import { EventType, GlobalState } from '@/models/global-state';
import { Bid, Event, Listing, Phunk } from '@/models/db';

import { createClient } from '@supabase/supabase-js'
import { Observable, of, BehaviorSubject, from, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

import * as dataStateActions from '@/state/actions/data-state.actions';

const supabaseUrl = 'https://kcbuycbhynlmsrvoegzp.supabase.co'
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey)

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

  private usd = new BehaviorSubject<number>(0);
  usd$ = this.usd.asObservable();

  filterData = filterData;

  attributes!: any;

  walletAddress$ = this.store.select(state => state.appState.walletAddress);

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    private web3Svc: Web3Service
  ) {
    // this.fetchUSDPrice();

    supabase
      .channel('any')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          if (!payload) return;
          const isEvent = payload?.table === 'events' + this.prefix;
          if (isEvent) this.store.dispatch(dataStateActions.dbEventTriggered({ payload }));
        },
      ).subscribe();

    // const throttled$ = sharedSource$.pipe(throttleTime(2000));
    // const debounced$ = sharedSource$.pipe(debounceTime(3000));
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
    return this.getAttributes().pipe(
      map((res: any) => {
        return phunks.map((item: Phunk) => ({
          ...item,
          attributes: res[item.phunkId]
        }));
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // OWNED /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchOwned(address: string): Observable<any[]> {
    address = address.toLowerCase();
    const request = supabase
      .from('phunks' + this.prefix)
      .select(`*, listings${this.prefix}(hashId, minValue, toAddress)`)
      .or(`owner.eq.${address},and(owner.eq.${environment.marketAddress},prevOwner.eq.${address})`);

    return from(request).pipe(
      map((res) => res.data as any[]),
      map((res: any) => res?.map((item: any) => {
        return {
          phunkId: item.phunkId,
          hashId: item.hashId,
          owner: item.owner,
          prevOwner: item.prevOwner,
          isEscrowed: item.owner === environment.marketAddress && item.prevOwner === address,
          listing: item['listings' + this.prefix] ? item['listings' + this.prefix] : null,
          attributes: [],
        };
      })),
      switchMap((phunks: Phunk[]) => this.addAttributes(phunks)),
    );
  }

  fetchUserOpenBids(address: string): Observable<any[]> {
    address = address.toLowerCase();
    const request = supabase
      .from('bids' + this.prefix)
      .select(`*, phunks${this.prefix}(phunkId)`)
      .eq('fromAddress', address);

    return from(request).pipe(
      // tap((res) => console.log('fetchUserOpenBids', res)),
      map((res) => res.data as any[]),
      map((res: any) => res.map((item: any) => {
        return {
          phunkId: item[`phunks${this.prefix}`].phunkId,
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
      switchMap((phunks: Phunk[]) => this.addAttributes(phunks)),
      tap((res) => console.log('fetchUserOpenBids', res)),
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

  fetchMarketData(): Observable<[any[], any[]]> { // bid[] listing[]
    const listingsQuery = supabase
      .from('listings' + this.prefix)
      .select(`*, phunks${this.prefix}(phunkId)`);

    const bidsQuery = supabase
      .from('bids' + this.prefix)
      .select(`*, phunks${this.prefix}(phunkId)`);

    return forkJoin([
      from(listingsQuery).pipe(map((res) => res.data || [] as any[])),
      from(bidsQuery).pipe(map((res) => res.data || [] as any[])),
    ]);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // EVENTS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchEvents(limit: number, type?: EventType): Observable<any> {
    let query = supabase
      .from('events' + this.prefix)
      .select('*')
      .neq('to', environment.auctionAddress) // remove auction events
      .neq('to', environment.marketAddress) // remove escrow events
      .neq('from', environment.auctionAddress) // remove auction events
      .neq('type', 'PhunkNoLongerForSale') // remove delist events
      .order('blockTimestamp', { ascending: false })
      .limit(limit);

    if (type && type !== 'All') query = query.eq('type', type);

    return from(query).pipe(
      map((res: any) => res.data)
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

  fetchSinglePhunk(phunkId: string): Observable<any> {
    let query = supabase
      .from('phunks' + this.prefix)
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
        phunkId,
        createdAt,
        owner,
        prevOwner,
      `)
      .limit(1);

    if (phunkId.startsWith('0x')) query = query.eq('hashId', phunkId);
    else query = query.eq('phunkId', phunkId);

    return from(query).pipe(
      map((res: any) => {
        const data = res.data ? res.data[0] : { phunkId };
        return data;
        // // if (!data[`auctions${this.prefix}`][0]) return data;
        // data.auction = data[`auctions${this.prefix}`][0]
        //   ? { ...data[`auctions${this.prefix}`][0] }
        //   : null;

        // data.auction.startTime = new Date(data.auction.startTime).getTime();
        // data.auction.endTime = new Date(data.auction.endTime).getTime();
        // delete data[`auctions${this.prefix}`];
        // return data;
      })
    );
  }

  async getListingForPhunkId(hashId: string | undefined): Promise<Listing | null> {
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

  async getBidForPhunkId(hashId: string | undefined): Promise<Bid | null> {
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
          .from('phunks' + this.prefix)
          .select()
          .in('hashId', hashIds)
          .eq('owner', address);

        return from(query).pipe(map((res: any) => res.data));
      }),
    );
  }

  phunksAreInEscrow(hashIds: Phunk['hashId'][]): Observable<any> {
    return this.walletAddress$.pipe(
      switchMap((address) => {
        const query = supabase
          .from('phunks' + this.prefix)
          .select()
          .in('hashId', hashIds)
          .eq('prevOwner', address)
          .eq('owner', this.escrowAddress);

        return from(query).pipe(map((res: any) => res.data));
      }),
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
      tap((res) => this.usd.next(res)),
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
}
