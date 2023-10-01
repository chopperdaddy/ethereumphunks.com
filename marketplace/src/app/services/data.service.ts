import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { StateService } from './state.service';

import { Attribute, Bid, Event, EventType, Listing, Phunk, State } from '@/models/graph';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { filterData } from '@/constants/filterData';

import { Observable, of, BehaviorSubject, EMPTY, from, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';

// import { Apollo, gql } from 'apollo-angular';
// import { QueryOptions } from '@apollo/client';

import { createClient } from '@supabase/supabase-js'

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';

const supabaseUrl = 'https://kcbuycbhynlmsrvoegzp.supabase.co'
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey)

// const WATCH_STATES_DATA = gql`
//   query GetStates($first: Int, $lastTimestamp: BigInt, $nowTimestamp: BigInt) {
//     states(
//       first: $first,
//       where: { timestamp_gt: $lastTimestamp, timestamp_lt: $nowTimestamp },
//       orderBy: "timestamp",
//       orderDirection: desc,
//     ) {
//       id
//       timestamp
//       usd
//       volume
//       floor
//       topSale {
//         tokenId
//         value
//       }
//       sales
//       owners
//       topBid {
//         tokenId
//         value
//       }
//       bids
//     }
//   }
// `;

// const GET_ALL_LISTINGS = gql`
//   query GetListings(
//     $listingSkip: Int!,
//     $bidSkip: Int!,
//     $limit: Int!
//   ) {
//     listings(
//       first: $limit,
//       skip: $listingSkip,
//       orderBy: "blockTimestamp",
//       orderDirection: desc
//     ) {
//       id
//       value
//       blockTimestamp
//     }

//     bids(
//       first: $limit,
//       skip: $bidSkip,
//       orderBy: "blockTimestamp",
//       orderDirection: desc
//     ) {
//       id
//       value
//       blockTimestamp
//     }
//   }
// `;

// const GET_TOP_SALES = gql`
//   query GetTopSales($limit: Int!) {
//     events(
//       where: {type: "Sale"},
//       first: $limit,
//       orderBy: value,
//       orderDirection: desc
//     ) {
//       type
//       tokenId
//       value
//       usd
//       blockTimestamp
//       transactionHash
//     }
//   }
// `;

@Injectable({
  providedIn: 'root'
})

export class DataService {

  staticUrl = environment.staticUrl;

  private attributesData!: any;

  private statesData = new BehaviorSubject<State[]>([]);
  statesData$ = this.statesData.asObservable();

  private marketData = new BehaviorSubject<Phunk[]>([]);
  marketData$ = this.marketData.asObservable();

  private ownedData = new BehaviorSubject<Phunk[]>([]);
  ownedData$ = this.ownedData.asObservable();

  private eventsData = new BehaviorSubject<Event[]>([]);
  eventsData$ = this.eventsData.asObservable();

  private currentFloor = new BehaviorSubject<number>(0);
  currentFloor$ = this.currentFloor.asObservable();

  private usd = new BehaviorSubject<number>(0);
  usd$ = this.usd.asObservable();

  filterData = filterData;

  attributes!: any;

  prefix: string = environment.chainId === 1 ? '_mainnet' : '_goerli';

  constructor(
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

    this.stateSvc.walletAddress$.pipe(
      switchMap((res) => res ? this.fetchOwned(res) : of([])),
      tap((res) => this.setOwned(res))
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

  fetchOwned(address: string): Observable<Phunk[]> {

    const request = supabase
      .from('phunks' + this.prefix)
      .select('*')
      .eq('owner', address);

    return from(request).pipe(
      map((res: any) => res.data.map((item: any) => ({
        id: item.phunkId,
        owner: {
          id: item.owner,
        },
        prevOwner: {
          id: item.prevOwner,
        },
        attributes: [],
      }))),
      switchMap((res: Phunk[]) => this.addAttributes(res)),
      catchError((err) => {
        console.log(err);
        return EMPTY;
      })
    );
  }

  getOwned(): Phunk[] {
    return this.ownedData.getValue();
  }

  setOwned(owned: Phunk[]): void {
    this.ownedData.next(owned);
  }

  getAllData(): Observable<Phunk[]> {
    return this.marketData$.pipe(
      switchMap(() => this.getAttributes()),
      map((attributes) => {
        const all = Object.keys(attributes).map((k) => ({
          id: k,
          attributes: (attributes as any)[k],
        }));
        for (const phunk of this.marketData.getValue()) {
          const i = Number(phunk.id);
          all[i] = phunk;
        }
        return all;
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // MARKET DATA ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  getMarketData(): void {

    // const pageLimit = 1000;
    // let bidSkip = 0;
    // let listingSkip = 0;
    // let isFirst = true;

    // const fetchDataWithCursor = (bidSkip: number, listingSkip: number) => {
    //   const q: QueryOptions = {
    //     query: GET_ALL_LISTINGS,
    //     variables: { bidSkip, listingSkip, limit: pageLimit },
    //   };
    //   return this.apollo.query(q);
    // };

    // const recursiveFetch = (bidSkip: number, listingSkip: number, bids: any[] = [], listings: any[] = []): Observable<any> => {
    //   return fetchDataWithCursor(bidSkip, listingSkip).pipe(
    //     switchMap((res: any) => {
    //       const newBids = [...bids, ...res.data.bids];
    //       const newListings = [...listings, ...res.data.listings];

    //       bidSkip += res.data.bids.length;
    //       listingSkip += res.data.listings.length;

    //       if (res.data.bids.length === pageLimit || res.data.listings.length === pageLimit) {
    //         return recursiveFetch(bidSkip, listingSkip, newBids, newListings);
    //       } else {
    //         return of({ bids: newBids, listings: newListings });
    //       }
    //     })
    //   );
    // };

    // timer(0, 30000).pipe(
    //   switchMap(() => recursiveFetch(bidSkip, listingSkip)),
    //   tap(() => {
    //     bidSkip = 0;
    //     listingSkip = 0;
    //   }),
    //   map(({ bids, listings }) => {
    //     const merged: any = {};
    //     for (const listing of listings) merged[listing.id] = {
    //       ...merged[listing.id],
    //       id: listing.id,
    //       listing,
    //     };
    //     for (const bid of bids) merged[bid.id] = {
    //       ...merged[bid.id],
    //       id: bid.id,
    //       bid,
    //     };
    //     return Object.values(merged) as Phunk[];
    //   }),
    //   switchMap((res: any) => this.addAttributes(res)),
    //   tap((res) => {
    //     if (isFirst) this.marketData.next(res);
    //     isFirst = false;
    //   }),
    //   tap((marketData) => this.marketData.next(marketData)),
    //   tap((res) => console.log('market!', res)),
    //   catchError((error) => {
    //     console.error('Error fetching data:', error);
    //     return EMPTY;
    //   }),
    // ).subscribe();
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
    console.log('fetchEvents', {limit, type});

    let query = supabase
      .from('events' + this.prefix)
      .select('*')
      .order('blockTimestamp', { ascending: false })
      .limit(limit);

    if (type && type !== 'All') {
      query = query.eq('type', type.toLowerCase());
    }

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
      tap((res) => console.log('fetchSingleTokenEvents', res)),
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
  // SINGLE PUNK ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchSinglePhunk(id: string): Observable<Phunk> {
    const request = supabase
      .from('phunks' + this.prefix)
      .select('*')
      .eq('phunkId', id)
      .single();

    return from(request).pipe(
      tap((res) => console.log('fetchSinglePhunk', res)),
      map((res: any) => ({
        id: res.data.phunkId,
        hashId: res.data.hashId,
        owner: {
          id: res.data.owner,
        },
        prevOwner: {
          id: res.data.prevOwner,
        },
        isEscrowed: res.data.owner === environment.phunksMarketAddress,
        attributes: [],
      })),
      switchMap((res: Phunk) => forkJoin([
        this.addAttributes([res]),
        from(Promise.all([
          this.getListingForPhunkId(res.hashId),
          this.getBidForPhunkId(res.hashId),
        ]))
      ])),
      map(([[res], [listing, bid]]) => ({
        ...res,
        listing,
        bid,
        attributes: res.attributes.sort((a: Attribute, b: Attribute) => {
          if (a.k === "Sex") return -1;
          if (b.k === "Sex") return 1;
          return 0;
        }),
      })),
      tap((res) => console.log(res)),
      catchError((err) => {
        console.log(err);
        return EMPTY;
      })
    );
  }

  async getListingForPhunkId(hashId: string | undefined): Promise<Listing | null> {
    if (!hashId) return null;

    const call = await this.web3Svc.readContract('phunksOfferedForSale', [hashId]);
    if (!call[0]) return null;

    return {
      id: call[1],
      value: call[3],
      fromAccount: {
        id: call[2]
      },
      toAccount: {
        id: call[4]
      },
    };
  }

  async getBidForPhunkId(hashId: string | undefined): Promise<Bid | null> {
    if (!hashId) return null;

    const call = await this.web3Svc.readContract('phunkBids', [hashId]);
    console.log('getBidForPhunkId', call);
    if (!call[0]) return null;

    return {
      id: call[1],
      value: call[3],
      fromAccount: {
        id: call[2]
      },
    };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CIG ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
