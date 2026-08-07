import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';

import * as appStateActions from '@/state/app/app-state.actions';

import * as dataStateActions from '@/state/data/data-state.actions';
import * as dataStateSelectors from '@/state/data/data-state.selectors';

import * as marketStateSelectors from '@/state/market/market-state.selectors';
import * as marketStateActions from '@/state/market/market-state.actions';

import { distinctUntilChanged, filter, map, switchMap, take, withLatestFrom } from 'rxjs';

@Injectable()
export class DataStateEffects {

  fetchCollections$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchCollections),
    switchMap(() => this.dataSvc.fetchCollections().pipe(
      map((collections) => dataStateActions.setCollections({ collections })),
    )),
  ));

  fetchDisabledCollections$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    switchMap(({ walletAddress }) => this.store.select(dataStateSelectors.selectCollections).pipe(
      filter((collections) => collections.length > 0),
      take(1),
      switchMap((collections) => this.dataSvc.fetchDisabledCollections().pipe(
        filter(disabledCollections => disabledCollections.length > 0),
        map((disabledCollections) => {
          const adminCollections = disabledCollections.filter(collection =>
            collection.adminAddress?.some((address: string) => address?.toLowerCase() === walletAddress?.toLowerCase())
          );
          return dataStateActions.setCollections({
            collections: [...collections, ...adminCollections]
          });
        }),
      )),
    )),
  ));

  setActiveCollection$ = createEffect(() => this.actions$.pipe(
    ofType(
      dataStateActions.setCollections,
      marketStateActions.setMarketSlug,
    ),
    withLatestFrom(
      this.store.select(dataStateSelectors.selectCollections),
      this.store.select(marketStateSelectors.selectMarketSlug),
    ),
    map(([, collections, slug]) => collections.find((c) => c.slug === slug)),
    filter((activeCollection) => !!activeCollection),
    distinctUntilChanged((a, b) => a?.slug === b?.slug),
    map((activeCollection) => dataStateActions.setActiveCollection({ activeCollection: { ...activeCollection! } }))
  ));

  fetchLeaderboard$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchLeaderboard),
    switchMap(() => this.dataSvc.fetchLeaderboard()),
    map((leaderboard) => dataStateActions.setLeaderboard({ leaderboard })),
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService
  ) {}
}
