import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { StateService } from './state.service';

import { Attribute, Bid, Event, EventType, Listing, Phunk, State } from '@/models/graph';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { filterData } from '@/constants/filterData';

import { Observable, of, BehaviorSubject, EMPTY, from, forkJoin, merge } from 'rxjs';
import { catchError, debounceTime, filter, map, skip, startWith, switchMap, tap, withLatestFrom } from 'rxjs/operators';

import { RealtimePostgresChangesPayload, createClient } from '@supabase/supabase-js'

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';
import { fetchMarketData, refreshSinglePhunk } from '@/state/actions/app-state.action';

const supabaseUrl = 'https://kcbuycbhynlmsrvoegzp.supabase.co'
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey)

@Injectable({
  providedIn: 'root'
})

export class DataService {

  public prefix: string = environment.chainId === 1 ? '_mainnet' : '_goerli';

  staticUrl = environment.staticUrl;

  private attributesData!: any;

  private statesData = new BehaviorSubject<State[]>([]);
  statesData$ = this.statesData.asObservable();

  private eventsData = new BehaviorSubject<Event[]>([]);
  eventsData$ = this.eventsData.asObservable();

  private currentFloor = new BehaviorSubject<number>(0);
  currentFloor$ = this.currentFloor.asObservable();

  private usd = new BehaviorSubject<number>(0);
  usd$ = this.usd.asObservable();

  private phunksTableUpdate = new BehaviorSubject<RealtimePostgresChangesPayload<any> | {}>({});
  phunksTableUpdate$ = this.phunksTableUpdate.asObservable();

  private eventsTableUpdate = new BehaviorSubject<RealtimePostgresChangesPayload<any> | {}>({});
  eventsTableUpdate$ = this.eventsTableUpdate.asObservable();

  private listingsTableUpdate = new BehaviorSubject<RealtimePostgresChangesPayload<any> | {}>({});
  listingsTableUpdate$ = this.listingsTableUpdate.asObservable();

  private bidsTableUpdate = new BehaviorSubject<RealtimePostgresChangesPayload<any> | {}>({});
  bidsTableUpdate$ = this.bidsTableUpdate.asObservable();

  filterData = filterData;

  attributes!: any;

  walletAddress$ = this.store.select(state => state.appState.walletAddress);

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    private stateSvc: StateService,
    private weiToEthPipe: WeiToEthPipe,
    private web3Svc: Web3Service
  ) {
    // this.fetchUSDPrice();
    // this.getMarketData();

    // this.watchStates().pipe(
    //   // Set the current floor
    //   tap((res) => this.currentFloor.next(this.weiToEthPipe.transform(res[0].floor)))
    // ).subscribe();

    supabase
      .channel('any')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {

        console.log('Realtime update', payload);

        if (!payload) return;
        const { table } = payload;

        // if (table === 'phunks' + this.prefix) {
        //   this.phunksTableUpdate.next(payload);
        // }

        if (table === 'events' + this.prefix) {
          this.store.dispatch(refreshSinglePhunk());
          this.store.dispatch(fetchMarketData());
        }

        // if (table === 'listings' + this.prefix) {
        //   this.store.dispatch(refreshSinglePhunk());
        //   this.store.dispatch(fetchMarketData());
        // }

        // if (table === 'bids' + this.prefix) {
        //   this.store.dispatch(refreshSinglePhunk());
        //   this.store.dispatch(fetchMarketData());
        // }

      }).subscribe();
  }

  getAllData(): Observable<Phunk[]> {
    return of([]);
    // return this.marketData$.pipe(
    //   switchMap(() => this.getAttributes()),
    //   map((attributes) => {
    //     const all = Object.keys(attributes).map((k) => ({
    //       id: k,
    //       attributes: (attributes as any)[k],
    //     }));
    //     for (const phunk of this.marketData.getValue()) {
    //       const i = Number(phunk.id);
    //       all[i] = phunk;
    //     }
    //     return all;
    //   })
    // );
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
          attributes: res[item.id]
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
      .select('*')
      .or(`owner.eq.${address},and(owner.eq.${environment.phunksMarketAddress},prevOwner.eq.${address})`);
    return from(request).pipe(map((res) => res.data as any[]));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // MARKET DATA ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchMarketData(): Observable<[Listing[], Bid[]]> {
    const listingsQuery = supabase
      .from('listings' + this.prefix)
      .select(`*, phunks${this.prefix}(phunkId)`);

    const bidsQuery = supabase
      .from('bids' + this.prefix)
      .select(`*, phunks${this.prefix}(phunkId)`);

    return forkJoin([
      from(listingsQuery).pipe(map((res) => res.data as any[])),
      from(bidsQuery).pipe(map((res) => res.data as any[])),
    ]);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // STATES ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  watchStates(): Observable<State[]> {
    return of([]);

    // const nowTimestamp = () => Math.floor(Date.now() / 1000);
    // let statesData: State[] = [];

    // return this.http.get<State[]>(`${environment.staticUrl}/_states.json`).pipe(
    //   switchMap((res: State[]) => {
    //     statesData = res;
    //     this.statesData.next(res);
    //     return this.apollo.watchQuery({
    //       query: WATCH_STATES_DATA,
    //       variables: {
    //         first: 1000,
    //         lastTimestamp: (Number(res[0]?.timestamp) + 1) || 0,
    //         nowTimestamp: nowTimestamp(),
    //       },
    //       pollInterval: 5000,
    //     }).valueChanges;
    //   }),
    //   map((res: any) => {
    //     const merged = [ ...statesData, ...res.data.states ];
    //     merged.sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp));
    //     this.statesData.next(merged);
    //     return merged;
    //   })
    // );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // EVENTS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchEvents(limit: number, type?: EventType): Observable<any> {
    let query = supabase
      .from('events' + this.prefix)
      .select('*')
      .order('blockTimestamp', { ascending: false })
      .limit(limit);

    if (type && type !== 'All') query = query.eq('type', type.toLowerCase());

    const response = query;
    return from(response).pipe(
      tap((res) => console.log('fetchEvents', res)),
      map((res: any) => res.data),
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
      .select('*')
      .limit(1);

    if (phunkId.startsWith('0x')) query = query.eq('hashId', phunkId);
    else query = query.eq('phunkId', phunkId);

    return from(query).pipe(map((res: any) => res.data[0]));
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
    // console.log('getBidForPhunkId', call);
    if (!call[0]) return null;

    return {
      createdAt: new Date(),
      hashId: call[1],
      value: call[3],
      fromAddress: call[2],
    };
  }

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
}
