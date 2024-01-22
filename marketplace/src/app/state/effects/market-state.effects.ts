import { GlobalState } from '@/models/global-state';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';
import { Store } from '@ngrx/store';

import { filter, from, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';

import * as marketStateActions from '../actions/market-state.actions';
import * as marketStateSelectors from '../selectors/market-state.selectors';

import * as dataStateActions from '../actions/data-state.actions';
import * as dataStateSelectors from '../selectors/data-state.selectors';

import * as appStateActions from '../actions/app-state.actions';
import * as appStateSelectors from '../selectors/app-state.selectors';

import { DataService } from '@/services/data.service';
import { MarketState } from '@/models/market.state';
import { Phunk } from '@/models/db';

@Injectable()
export class MarketStateEffects {

  defaultFetchLength = 249;

  setMarketFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
    ),
    mergeMap(([_, queryParams, routeParams]) => {
      return [
        marketStateActions.setMarketType({ marketType: routeParams['marketType'] }),
        marketStateActions.setMarketSlug({ marketSlug: routeParams['slug'] || 'ethereum-phunks' }),
        marketStateActions.setActiveTraitFilters({ traitFilters: queryParams }),
      ];
    })
  ));

  // Set active market data based on market type
  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketType),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(getRouterSelectors().selectRouteParam('slug')),
      this.store.select(getRouterSelectors().selectQueryParam('address')),
    ),
    filter(([, marketType]) => marketType !== 'all'),
    switchMap(([action, marketType, marketSlug, queryAddress]) => {
      // Likely exited market route so we clear some state

      if (!marketType) {
        this.store.dispatch(marketStateActions.clearActiveMarketRouteData());
        return from([]);
      }

      if (queryAddress) {
        // console.log('onMarketTypeChanged$', action);
        return this.store.select(appStateSelectors.selectWalletAddress).pipe(
          switchMap((res) => {
            if (res && res === queryAddress?.toLowerCase()) {
              if (marketType === 'bids') return this.store.select(dataStateSelectors.selectUserOpenBids);
              return this.store.select(marketStateSelectors.selectOwned);
            } else {
              return this.dataSvc.fetchOwned(queryAddress, marketSlug);
            }
          }),
        );
      }

      if (marketType === 'listings') return this.store.select(marketStateSelectors.selectListings);
      if (marketType === 'bids') return this.store.select(marketStateSelectors.selectBids);

      return of([]);
    }),
    map((data) => ({ data, total: data.length })),
    map((activeMarketRouteData: MarketState['activeMarketRouteData']) =>
      marketStateActions.setActiveMarketRouteData({ activeMarketRouteData })
    ),
  ));

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(
      marketStateActions.fetchMarketData,
      marketStateActions.triggerDataRefresh
    ),
    switchMap(() => {
      return this.store.select(marketStateSelectors.selectMarketSlug).pipe(
        filter((slug) => !!slug),
        switchMap((slug) => this.dataSvc.fetchMarketData(slug)),
        map((marketData) => marketStateActions.setMarketData({ marketData }))
      )
    })
  ));

  fetchAll$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketData),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketSlug),
      this.store.select(marketStateSelectors.selectAll)
    ),
    switchMap(([action, marketSlug, all]) => {
      if (all.length) return of(all);
      return this.dataSvc.fetchAllWithPagination(marketSlug, 0, 110, {}).pipe(
        map((data: MarketState['activeMarketRouteData']) => data.data)
      );
    }),
    map((phunks: Phunk[]) => marketStateActions.setAll({ all: phunks }))
  ));

  paginateAll$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setPagination),
    // distinctUntilChanged((a, b) => a.pagination.fromIndex === b.pagination.fromIndex),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketSlug),
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(marketStateSelectors.selectActiveMarketRouteData),
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
    ),
    filter(([action, , marketType]) => {
      return marketType === 'all' && (this.defaultFetchLength + 1) <= action.pagination.toIndex;
    }),
    // tap((action) => console.log('paginateAll', action)),
    switchMap(([action, marketSlug, marketType, routeData, traitFilters]) => {
      return this.dataSvc.fetchAllWithPagination(
        marketSlug,
        action.pagination.fromIndex,
        action.pagination.toIndex,
        traitFilters
      ).pipe(
        map((data: MarketState['activeMarketRouteData']) => {
          return {
            data: [...routeData.data, ...data.data],
            total: data.total,
          };
        })
      );
    }),
    map((activeMarketRouteData: MarketState['activeMarketRouteData']) =>
      marketStateActions.setActiveMarketRouteData({ activeMarketRouteData })
    ),
  ));

  fetchOwned$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.setWalletAddress,
      marketStateActions.triggerDataRefresh
    ),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    switchMap(([_, address]) => {
      return this.store.select(marketStateSelectors.selectMarketSlug).pipe(
        switchMap((slug) => this.dataSvc.fetchOwned(address, slug)),
      );
    }),
    map((phunks) => marketStateActions.setOwned({ owned: phunks })),
  ));

  setUserOpenBids$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketData),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectWalletAddress).pipe(
        map((address) => {
          return dataStateActions.setUserOpenBids({
            userOpenBids: action.marketData?.filter((item) => item.bid && item.bid?.fromAddress === address) || []
          });
        })
      );
    })
  ));

  setTraitFilter$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setActiveTraitFilters),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(marketStateSelectors.selectMarketSlug),
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
    ),
    filter(([action, marketType]) => marketType === 'all'),
    switchMap(([action, marketType, slug, traitFilters]) => {
      return this.dataSvc.fetchAllWithPagination(slug, 0, this.defaultFetchLength, traitFilters).pipe(
        mergeMap((data: MarketState['activeMarketRouteData']) => [
          marketStateActions.setActiveMarketRouteData({ activeMarketRouteData: data })
        ]),
      );
    })
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService
  ) {}

}
