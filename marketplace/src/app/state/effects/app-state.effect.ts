import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { GlobalState } from '@/models/global-state';

import { delay, distinctUntilChanged, filter, forkJoin, from, map, switchMap, tap, withLatestFrom } from 'rxjs';

import {
  setHasWithdrawal,
  setWalletAddress,
  fetchSinglePhunk,
  setSinglePhunk,
  refreshSinglePhunk,
  fetchMarketData,
  setMarketData,
  setOwnedPhunks
} from '../actions/app-state.action';
import { selectSinglePhunk } from '../selectors/app-state.selector';
import { Attribute, Phunk } from '@/models/graph';
import { environment } from 'src/environments/environment';

@Injectable()
export class AppStateEffects {

  fetchSinglePhunk$ = createEffect(() => this.actions$.pipe(
    ofType(fetchSinglePhunk),
    // delay(1000),
    switchMap((action) => this.dataSvc.fetchSinglePhunk(action.phunkId)),
    map((phunk: any) => ({
      id: phunk?.phunkId,
      hashId: phunk?.hashId,
      owner: phunk?.owner,
      prevOwner: phunk?.prevOwner,
      isEscrowed: phunk?.owner === environment.phunksMarketAddress,
      attributes: [],
    })),
    switchMap((res: Phunk) => forkJoin([
      this.dataSvc.addAttributes([res]),
      from(Promise.all([
        this.dataSvc.getListingForPhunkId(res.hashId),
        this.dataSvc.getBidForPhunkId(res.hashId),
      ]))
    ])),
    map(([[res], [listing, bid]]) => ({
      ...res,
      listing,
      bid,
      attributes: [ ...res.attributes ].sort((a: Attribute, b: Attribute) => {
        if (a.k === "Sex") return -1;
        if (b.k === "Sex") return 1;
        return 0;
      }),
    })),
    map((phunk) => setSinglePhunk({ phunk })),
    tap((res) => console.log('fetchSinglePhunk', res)),
  ));

  refreshSinglePhunk$ = createEffect(() => this.actions$.pipe(
    ofType(refreshSinglePhunk),
    withLatestFrom(this.store.select(selectSinglePhunk)),
    tap(([action, phunk]) => console.log('refreshSinglePhunk', action, phunk)),
    filter(([action, phunk]) => !!phunk),
    map(([action, phunk]) => fetchSinglePhunk({ phunkId: `${phunk!.id}` })),
  ));

  checkHasWithdrawal$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    map(action => action.walletAddress),
    distinctUntilChanged(),
    switchMap((walletAddress) => from(this.web3Svc.checkHasWithdrawal(walletAddress))),
    map(has => setHasWithdrawal({ hasWithdrawal: has })
  )));

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(fetchMarketData),
    switchMap(() => this.dataSvc.fetchMarketData()),
    map(([listings, bids]) => {
      const merged: any = {};
      for (const listing of listings) merged[listing.hashId] = {
        ...merged[listing.hashId],
        id: listing['phunks' + this.dataSvc.prefix].phunkId,
        hashId: listing.hashId,
        listing,
      };
      for (const bid of bids) merged[bid.hashId] = {
        ...merged[bid.hashId],
        id: bid['phunks' + this.dataSvc.prefix].phunkId,
        hashId: bid.hashId,
        bid,
      };
      return Object.values(merged) as Phunk[];
    }),
    switchMap((res: any) => this.dataSvc.addAttributes(res)),
    tap((action) => console.log('fetchMarketData', action)),
    map((phunks) => setMarketData({ marketData: phunks })),
  ));

  fetchOwnedPhunks$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    filter(action => !!action.walletAddress),
    map(action => action.walletAddress),
    distinctUntilChanged(),
    tap((action) => console.log('fetchOwnedPhunks', action)),
    switchMap((walletAddress) => this.dataSvc.fetchOwned(walletAddress)),
    map((res: any) => res.map((item: any) => ({
      id: item.phunkId,
      owner: item.owner,
      prevOwner: item.prevOwner,
      attributes: [],
    }))),
    map((phunks) => setOwnedPhunks({ ownedPhunks: phunks })),
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private dataSvc: DataService,
  ) {}
}
