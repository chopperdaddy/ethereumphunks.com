import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from 'src/environments/environment';

import { Observable, of, BehaviorSubject, EMPTY, forkJoin, interval, timer } from 'rxjs';
import { catchError, concatMap, expand, map, scan, switchMap, tap, toArray } from 'rxjs/operators';

import { Apollo, WatchQueryOptions, gql } from 'apollo-angular';
import { ApolloQueryResult, QueryOptions } from '@apollo/client';

import { Attribute, Event, EventType, Listing, Punk, State } from '@/models/graph';

import { StateService } from './state.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { filterData } from '@/constants/filterData';

const WATCH_STATES_DATA = gql`
  query GetStates($first: Int, $lastTimestamp: BigInt, $nowTimestamp: BigInt) {
    states(
      first: $first,
      where: { timestamp_gt: $lastTimestamp, timestamp_lt: $nowTimestamp },
      orderBy: "timestamp",
      orderDirection: desc,
    ) {
      id
      timestamp
      usd
      volume
      floor
      topSale {
        tokenId
        value
      }
      sales
      owners
      topBid {
        tokenId
        value
      }
      bids
    }
  }
`;

const GET_ALL_LISTINGS = gql`
  query GetListings(
    $listingSkip: Int!,
    $bidSkip: Int!,
    $limit: Int!
  ) {
    listings(
      first: $limit,
      skip: $listingSkip,
      orderBy: "blockTimestamp",
      orderDirection: desc
    ) {
      id
      value
      blockTimestamp
    }

    bids(
      first: $limit,
      skip: $bidSkip,
      orderBy: "blockTimestamp",
      orderDirection: desc
    ) {
      id
      value
      blockTimestamp
    }
  }
`;

const GET_EVENTS = gql`
  query GetEvents($limit: Int!) {
    events(
      orderBy: "blockTimestamp",
      orderDirection: desc,
      first: $limit
    ) {
      type
      tokenId
      blockTimestamp
      value
      usd
      toAccount {
        id
      }
    }
  }
`;

const GET_EVENTS_TYPE = gql`
  query GetEvents($limit: Int!, $type: String!) {
    events(
      orderBy: "blockTimestamp",
      orderDirection: desc,
      first: $limit
      where: { type: $type }
    ) {
      type
      tokenId
      blockTimestamp
      value
      usd
      toAccount {
        id
      }
    }
  }
`;

const GET_TOP_SALES = gql`
  query GetTopSales($limit: Int!) {
    events(
      where: {type: "Sale"},
      first: $limit,
      orderBy: value,
      orderDirection: desc
    ) {
      type
      tokenId
      value
      usd
      blockTimestamp
      transactionHash
    }
  }
`;

const GET_OWNED = gql`
  query GetOwned($address: String!) {
    account(id: $address) {
      id
      punks(
        first: 1000,
      ) {
        id
      }
    }
  }
`;

const GET_PUNK = gql`
query GetPunk($id: String!) {
  punk(id: $id) {
    id
    listing {
      value
      toAccount {
        id
      }
    }
    owner {
      id
    }
    wrapped
    bid {
      fromAccount {
        id
      }
      value
    }
  }
}
`;

@Injectable({
  providedIn: 'root'
})

export class DataService {

  staticUrl = environment.staticUrl;

  private attributesData!: any;

  private statesData = new BehaviorSubject<State[]>([]);
  statesData$ = this.statesData.asObservable();

  private marketData = new BehaviorSubject<Punk[]>([]);
  marketData$ = this.marketData.asObservable();

  private ownedData = new BehaviorSubject<Punk[]>([]);
  ownedData$ = this.ownedData.asObservable();

  private eventsData = new BehaviorSubject<Event[]>([]);
  eventsData$ = this.eventsData.asObservable();

  private currentFloor = new BehaviorSubject<number>(0);
  currentFloor$ = this.currentFloor.asObservable();

  private usd = new BehaviorSubject<number>(0);
  usd$ = this.usd.asObservable();

  filterData = filterData;

  attributes!: any;

  constructor(
    private http: HttpClient,
    private apollo: Apollo,
    private stateSvc: StateService,
    private weiToEthPipe: WeiToEthPipe
  ) {
    // this.fetchUSDPrice();
    // this.getMarketData();

    // this.watchStates().pipe(
    //   // Set the current floor
    //   tap((res) => this.currentFloor.next(this.weiToEthPipe.transform(res[0].floor)))
    // ).subscribe();

    // this.stateSvc.walletAddress$.pipe(
    //   switchMap((res) => res ? this.fetchOwned(res) : of([])),
    //   tap((res) => this.setOwned(res))
    // ).subscribe();
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

  addAttributes(punks: Punk[]): Observable<Punk[]> {
    return this.getAttributes().pipe(
      map((res: any) => {
        return punks.map((item: Punk) => ({
          ...item,
          attributes: res[item.id]
        }));
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // OWNED /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchOwned(address: string): Observable<Punk[]> {
    const q: WatchQueryOptions = {
      query: GET_OWNED,
      variables: { address },
      pollInterval: 5000,
    };

    return this.apollo.watchQuery(q).valueChanges.pipe(
      // tap((res: any) => console.log('owned!', res)),
      map((res: any) => res.data.account?.punks || []),
      switchMap((res: any) => this.addAttributes(res)),
      catchError((error) => {
        console.log('Error fetching data:', error);
        return [];
      }),
    )
  }

  getOwned(): Punk[] {
    return this.ownedData.getValue();
  }

  setOwned(owned: Punk[]): void {
    this.ownedData.next(owned);
  }

  getAllData(): Observable<Punk[]> {

    return this.marketData$.pipe(
      switchMap(() => this.getAttributes()),
      map((attributes) => {
        const all = Object.keys(attributes).map((k) => ({
          id: k,
          attributes: (attributes as any)[k],
        }));
        for (const punk of this.marketData.getValue()) {
          const i = Number(punk.id);
          all[i] = punk;
        }
        return all;
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // MARKET DATA ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  getMarketData(): void {

    const pageLimit = 1000;
    let bidSkip = 0;
    let listingSkip = 0;
    let isFirst = true;

    const fetchDataWithCursor = (bidSkip: number, listingSkip: number) => {
      const q: QueryOptions = {
        query: GET_ALL_LISTINGS,
        variables: { bidSkip, listingSkip, limit: pageLimit },
      };
      return this.apollo.query(q);
    };

    const recursiveFetch = (bidSkip: number, listingSkip: number, bids: any[] = [], listings: any[] = []): Observable<any> => {
      return fetchDataWithCursor(bidSkip, listingSkip).pipe(
        switchMap((res: any) => {
          const newBids = [...bids, ...res.data.bids];
          const newListings = [...listings, ...res.data.listings];

          bidSkip += res.data.bids.length;
          listingSkip += res.data.listings.length;

          if (res.data.bids.length === pageLimit || res.data.listings.length === pageLimit) {
            return recursiveFetch(bidSkip, listingSkip, newBids, newListings);
          } else {
            return of({ bids: newBids, listings: newListings });
          }
        })
      );
    };

    timer(0, 30000).pipe(
      switchMap(() => recursiveFetch(bidSkip, listingSkip)),
      tap(() => {
        bidSkip = 0;
        listingSkip = 0;
      }),
      map(({ bids, listings }) => {
        const merged: any = {};
        for (const listing of listings) merged[listing.id] = {
          ...merged[listing.id],
          id: listing.id,
          listing,
        };
        for (const bid of bids) merged[bid.id] = {
          ...merged[bid.id],
          id: bid.id,
          bid,
        };
        return Object.values(merged) as Punk[];
      }),
      switchMap((res: any) => this.addAttributes(res)),
      tap((res) => {
        if (isFirst) this.marketData.next(res);
        isFirst = false;
      }),
      switchMap((res: any) => forkJoin([ this.getReservoirData(), of(res) ])),
      tap(([ reservoirData, marketData ]) => this.marketData.next([...marketData, ...reservoirData])),
      tap((res) => console.log('market!', res)),
      catchError((error) => {
        console.error('Error fetching data:', error);
        return EMPTY;
      }),
    ).subscribe();
  }

  getReservoirData(): Observable<any> {

    const params = {
      contracts: ['0xb7f7f6c52f2e2fdb1963eab30438024864c313f6'],
      sortBy: 'price',
      sortDirection: 'desc',
      limit: 1000,
    };

    const listingsCall = this.http.get(`https://api.reservoir.tools/orders/asks/v4`, {params}).pipe(
      map((res: any) => res.orders),
      catchError((error) => {
        console.log('Error fetching listingsCall:', error);
        return [];
      })
    );

    const bidsCall = this.http.get(`https://api.reservoir.tools/orders/bids/v5`, {params}).pipe(
      map((res: any) => res.orders),
      catchError((error) => {
        console.error('Error fetching bidsCall:', error);
        return [];
      })
    );

    function removeDuplicates(listings: any[]) {
      let map = new Map();

      for(let listing of listings) {
        let tokenId = listing.criteria.data.token.tokenId;
        let price = listing.price.amount.usd;
        // If the map already has the token ID and the stored price is lower, skip this listing
        if (map.has(tokenId) && map.get(tokenId).price.amount.usd <= price) continue;
        // Otherwise, store/update the map with this listing
        map.set(tokenId, listing);
      }

      // Convert the map values to an array (since map.values() returns an iterator)
      return Array.from(map.values());
    }

    return listingsCall.pipe(
      map((res) => removeDuplicates(res)),
      map((res: any) => {
        return res.map((item: any) => ({
          id: item.criteria.data.token?.tokenId,
          wrapped: true,
          listing: {
            value: item.price.amount.raw,
            blockTimestamp: item.validFrom,
            source: item.source
          }
        })) as Punk[];
      }),
      switchMap((res: any) => this.addAttributes(res)),
      catchError((error) => {
        console.log('Error fetching data:', error);
        return [];
      }),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // STATES ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  watchStates(): Observable<State[]> {

    const nowTimestamp = () => Math.floor(Date.now() / 1000);
    let statesData: State[] = [];

    return this.http.get<State[]>(`${environment.staticUrl}/_states.json`).pipe(
      switchMap((res: State[]) => {
        statesData = res;
        this.statesData.next(res);
        return this.apollo.watchQuery({
          query: WATCH_STATES_DATA,
          variables: {
            first: 1000,
            lastTimestamp: (Number(res[0]?.timestamp) + 1) || 0,
            nowTimestamp: nowTimestamp(),
          },
          pollInterval: 5000,
        }).valueChanges;
      }),
      map((res: any) => {
        const merged = [ ...statesData, ...res.data.states ];
        merged.sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp));
        this.statesData.next(merged);
        return merged;
      })
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // EVENTS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchEvents(limit: number, type?: EventType): Observable<any> {

    const q: any = {
      variables: {
        skip: 0,
        limit: limit,
      },
      pollInterval: 5000,
    };

    if (type === 'All') q.query = GET_EVENTS;
    else {
      q.query = GET_EVENTS_TYPE;
      q.variables['type'] = type;
    }

    return this.apollo.watchQuery(q).valueChanges.pipe(
      map((result: any) => result.data.events as any[]),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // TOP SALES /////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchTopSales(limit: number): Observable<any> {
    return this.apollo.watchQuery({
      query: GET_TOP_SALES,
      variables: {
        skip: 0,
        limit: limit,
      },
      pollInterval: 5000,
    }).valueChanges.pipe(
      map((result: any) => result.data.events as any[]),
    );
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // SINGLE PUNK ///////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  fetchSinglePunk(id: string): Observable<Punk> {
    return this.apollo.watchQuery<{ punk: Punk }>({
      query: GET_PUNK,
      variables: { id },
      pollInterval: 5000,
    }).valueChanges.pipe(
      map((res: ApolloQueryResult<{ punk: Punk }>) => res.data?.punk || null),
      switchMap((res: Punk) => this.addAttributes([res])),
      map((res) => ({
        ...res[0],
        attributes: res[0].attributes.sort((a: Attribute, b: Attribute) => {
          if (a.k === "Sex") return -1;
          if (b.k === "Sex") return 1;
          return 0;
        }),
      })),
      catchError((err) => {
        console.log(err);
        return EMPTY;
      })
    );
  }

  fetchSinglePunkListing(id: string): Observable<any> {

    const params = {
      token: `0xb7f7f6c52f2e2fdb1963eab30438024864c313f6:${id}`,
      sortBy: 'price',
      sortDirection: 'desc',
      status: 'active',
      limit: 1,
    };

    return this.http.get(`https://api.reservoir.tools/orders/asks/v4`, {params}).pipe(
      // tap((res) => console.log('Listing', res)),
      map(({ orders }: any) => ({
        id,
        value: orders[0]?.price?.amount?.raw,
        source: orders[0]?.source,
      } as Listing)),
      catchError((error) => {
        console.error('Error fetching listingsCall:', error);
        return EMPTY;
      })
    );
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
