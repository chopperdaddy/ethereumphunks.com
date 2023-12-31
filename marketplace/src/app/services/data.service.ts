import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';

import { filterData } from '@/constants/filterData';

import { EventType, GlobalState } from '@/models/global-state';
import { Attribute, Bid, Event, Listing, Phunk } from '@/models/db';

import { createClient } from '@supabase/supabase-js'
import { Observable, of, BehaviorSubject, from, forkJoin, firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { environment } from 'src/environments/environment';

import * as dataStateActions from '@/state/actions/data-state.actions';
import { NgForage } from 'ngforage';

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

  getAttributes(slug: string): Observable<any> {
    return from(this.ngForage.getItem(`${slug}_attributes`)).pipe(
      switchMap((res: any) => {
        if (res) return of(res);
        return this.http.get(`${environment.staticUrl}/data/${slug}_attributes.json`).pipe(
          tap((res: any) => this.ngForage.setItem(`${slug}_attributes`, res)),
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
  ): Observable<any[]> {
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
        }
      })),
      switchMap((res: any) => this.addAttributes(slug, res)),
    ) as Observable<any>;
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
      tap((res) => console.log('fetchEvents', res)),
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
      map((res: any) => res.data.map((item: any) => ({
        ...item,
        ...item[`ethscriptions${this.prefix}`],
      }))),
      tap((res) => console.log('fetchSingleTokenEvents', res)),
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
    // console.log('fetchSinglePhunk', {tokenId});

    let query = supabase
      .from('ethscriptions' + this.prefix)
      .select(`
        hashId,
        sha,
        tokenId,
        createdAt,
        owner,
        prevOwner,
        collections${this.prefix}(singleName, slug, name)
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
      map(([[res], [listing, bid]]) => ({
        ...res,
        listing,
        bid,
        attributes: [ ...(res.attributes || []) ].sort((a: Attribute, b: Attribute) => {
          if (a.k === "Sex") return -1;
          if (b.k === "Sex") return 1;
          return 0;
        }),
      })),
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
    prevOwner: string
  ): Promise<boolean> {
    if (!hashId || !owner) return false;
    return await firstValueFrom(
      this.http.get(`https://${this.prefix.replace('_', '-')}api.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
        map((res: any) => {
          if (!res) return false;
          if (res.current_owner.toLowerCase() !== owner.toLowerCase()) return false;
          if (
            (res.previous_owner && prevOwner) &&
            res.previous_owner.toLowerCase() !== prevOwner.toLowerCase()
          ) return false;
          return true;
        }),
      )
    )
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CHECKS ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  phunksCanTransfer(hashIds: Phunk['hashId'][]): Observable<any> {
    return this.walletAddress$.pipe(
      switchMap((address) => {
        const query = supabase
          .from('ethscriptions' + this.prefix)
          .select('*')
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
          .select('*')
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

  async fetchAll(
    slug: string,
    from: number,
    to: number
  ) {
    const query = supabase
      .from('ethscriptions' + this.prefix)
      .select('tokenId, hashId, sha')
      .eq('slug', slug)
      .order('tokenId', { ascending: true })
      .range(from, to);

    const { data, error } = await query;
    if (error) throw error;
    return data;
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
