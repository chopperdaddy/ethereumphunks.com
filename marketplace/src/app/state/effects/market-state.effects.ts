import { GlobalState } from '@/models/global-state';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';
import { Store } from '@ngrx/store';

import { filter, from, map, switchMap, tap, withLatestFrom } from 'rxjs';

import * as marketStateActions from '../actions/market-state.actions';
import * as marketStateSelectors from '../selectors/market-state.selectors';

import * as dataStateActions from '../actions/data-state.actions';
import * as dataStateSelectors from '../selectors/data-state.selectors';

import * as appStateActions from '../actions/app-state.actions';
import * as appStateSelectors from '../selectors/app-state.selectors';

import { DataService } from '@/services/data.service';
import { MarketState } from '@/models/market.state';
import { HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';
import { Phunk } from '@/models/db';

@Injectable()
export class MarketStateEffects {

  // Set active market data based on market type
  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketType),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(getRouterSelectors().selectRouteParam('slug')),
      this.store.select(getRouterSelectors().selectQueryParam('address')),
    ),
    switchMap(([action, marketType, marketSlug, queryAddress]) => {

      // Likely exited market route so we clear some state
      if (!marketType) {
        this.store.dispatch(marketStateActions.clearActiveTraitFilters());
        this.store.dispatch(marketStateActions.clearActiveMarketRouteData());
        return from([]);
      }

      if (queryAddress) {
        return this.store.select(appStateSelectors.selectWalletAddress).pipe(
          switchMap((res) => {
            if (res && res === queryAddress?.toLowerCase()) {
              if (marketType === 'bids') return this.store.select(dataStateSelectors.selectUserOpenBids);
              return this.store.select(marketStateSelectors.selectOwned);
            } else {
              return this.dataSvc.fetchOwned(queryAddress, marketSlug);
            }
          }),
          map((data) => data || []),
        );
      }

      if (marketType === 'all') return this.store.select(marketStateSelectors.selectAll);

      if (marketType === 'listings') return this.store.select(marketStateSelectors.selectListings);
      if (marketType === 'bids') return this.store.select(marketStateSelectors.selectBids);

      // Default to listings
      return this.store.select(marketStateSelectors.selectListings);
    }),
    map((data: MarketState['activeMarketRouteData']) => marketStateActions.setActiveMarketRouteData({ activeMarketRouteData: data })),
  ));

  setMarketTypeFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    withLatestFrom(this.store.select(getRouterSelectors().selectRouteParams)),
    tap(([action, routeParams]) => {
      this.store.dispatch(marketStateActions.setMarketType({ marketType: routeParams['marketType'] }));
      this.store.dispatch(marketStateActions.setMarketSlug({ marketSlug: routeParams['slug'] || 'ethereum-phunks' }));
    })
  ), { dispatch: false });

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
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
    ),
    switchMap(([action, marketSlug, filters]) => {
      return this.dataSvc.fetchAll(marketSlug, 0, 500, filters).pipe(
        map((phunks: any) => marketStateActions.setAll({ all: phunks }))
      )
    })
  ));

  // paginateAll$ = createEffect(() => this.actions$.pipe(
  //   ofType(marketStateActions.paginateAll),
  //   distinctUntilChanged((a, b) => a.limit === b.limit),
  //   withLatestFrom(
  //     this.store.select(marketStateSelectors.selectMarketSlug),
  //     this.store.select(marketStateSelectors.selectMarketType),
  //     this.store.select(marketStateSelectors.selectAll),
  //     this.store.select(marketStateSelectors.selectActiveTraitFilters),
  //   ),
  //   filter(([action, marketSlug, marketType]) => marketType === 'all'),
  //   switchMap(([action, marketSlug, marketType, selectAll, traitFilters]) => {
  //     return this.store.select(marketStateSelectors.selectActiveTraitFilters).pipe(
  //       switchMap((filters) => {
  //         const limit = action.limit;

  //         let allItems = selectAll || [];
  //         if (JSON.stringify(filters) !== JSON.stringify(traitFilters)) allItems = [];

  //         console.log('paginateAll', filters, traitFilters, allItems.length, limit);

  //         return this.dataSvc.fetchAll(marketSlug, allItems.length, limit, filters).pipe(
  //           map((newPhunks: any) => {
  //             const all = [...allItems, ...newPhunks].sort((a, b) => a.tokenId - b.tokenId);
  //             return marketStateActions.setAll({ all });
  //           })
  //         )
  //       })
  //     );
  //   }),
  // ));

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

  addTraitFilter$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.addRemoveTraitFilter),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
      this.store.select(getRouterSelectors().selectQueryParams),
    ),
    tap(([action, activeTraitFilters, queryParams]) => {
      let params: any = {};
      if (queryParams.address) params.address = queryParams.address;
      params = { ...params, ...activeTraitFilters };

      let urlParams = new HttpParams();
      Object.keys(params).map((key) => {
        if (params[key]) urlParams = urlParams.append(key, params[key]);
      });

      this.location.go(this.location.path().split('?')[0], urlParams.toString());
    }),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService,
    private location: Location,
  ) {}

}
