import { GlobalState } from '@/models/global-state';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { ROUTER_NAVIGATION, RouterNavigationPayload, getRouterSelectors } from '@ngrx/router-store';
import { Store } from '@ngrx/store';

import { combineLatest, distinctUntilChanged, filter, from, map, mergeMap, of, scan, switchMap, tap, withLatestFrom } from 'rxjs';

import * as marketStateActions from '../market/market-state.actions';
import * as marketStateSelectors from '../market/market-state.selectors';

import * as dataStateActions from '../data/data-state.actions';
import * as dataStateSelectors from '../data/data-state.selectors';

import * as appStateActions from '../app/app-state.actions';
import * as appStateSelectors from '../app/app-state.selectors';

import { DataService } from '@/services/data.service';
import { MarketState, MarketType } from '@/models/market.state';

import { Phunk, Event } from '@/models/db';
import { defaultSort, marketSorts } from '@/constants/sorts';

@Injectable()
export class MarketStateEffects {

  defaultFetchLength = 249;

  setMarketFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
      this.store.select(appStateSelectors.selectConfig),
    ),
    mergeMap(([{ payload }, queryParams, routeParams, config]) => {
      const marketType = routeParams['marketType'] as MarketType;

      const actions: any[] = [
        marketStateActions.setMarketType({ marketType }),
      ];

      // Use route params if available
      let marketSlug = routeParams['slug'];

      // Use default slug if no slug is available
      const { event } = payload as RouterNavigationPayload;
      if (event.urlAfterRedirects === '/') marketSlug = config.defaultCollection;

      // Set market slug if available
      if (marketSlug) {
        actions.push(marketStateActions.setMarketSlug({ marketSlug }));
      }

      actions.push(marketStateActions.setActiveTraitFilters({ traitFilters: queryParams }));
      actions.push(marketStateActions.setActiveSort({ activeSort: defaultSort[marketType] }));
      return actions;
    })
  ));

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

      // console.log({ action, marketType, marketSlug, queryAddress });

      if (!marketType || !marketSlug) {
        this.store.dispatch(marketStateActions.clearActiveMarketRouteData());
        return from([]);
      }

      if (queryAddress && typeof queryAddress === 'string') {
        return this.store.select(appStateSelectors.selectWalletAddress).pipe(
          switchMap((res) => {
            if (res && res === queryAddress?.toLowerCase()) {
              // if (marketType === 'bids') return this.store.select(dataStateSelectors.selectUserOpenBids);
              return this.store.select(marketStateSelectors.selectOwned);
            } else {
              return this.dataSvc.fetchOwned(queryAddress, marketSlug);
            }
          }),
        );
      }

      if (marketType === 'listings') return this.store.select(marketStateSelectors.selectListings);
      if (marketType === 'auctions') return this.store.select(marketStateSelectors.selectAuctions);
      if (marketType === 'activity') return this.store.select(dataStateSelectors.selectEvents).pipe(
        map((events) => {
          return events?.map((event) => {
            return {
              hashId: event.hashId,
              tokenId: event.tokenId,
              sha: event.sha,
              event: event,
            } as Phunk;
          }) || [];
        })
      );

      return of([]);
    }),
    // tap((data) => console.log('onMarketTypeChanged$', data)),
    map((data) => ({ data, total: data.length })),
    map((activeMarketRouteData: MarketState['activeMarketRouteData']) =>
      marketStateActions.setActiveMarketRouteData({ activeMarketRouteData })
    ),
  ));

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketSlug),
    distinctUntilChanged((a, b) => a.marketSlug === b.marketSlug),
    switchMap(({ marketSlug }) => this.dataSvc.fetchMarketData(marketSlug)),
    map((marketData) => marketStateActions.setMarketData({ marketData }))
  ));

  fetchOwned$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    distinctUntilChanged((a, b) => a.walletAddress === b.walletAddress),
    switchMap(({ walletAddress }) => {
      if (!walletAddress) return of([]);
      return this.store.select(marketStateSelectors.selectMarketSlug).pipe(
        distinctUntilChanged(),
        switchMap((slug) => this.dataSvc.fetchOwned(walletAddress, slug)),
      );
    }),
    // tap((phunks) => console.log('fetchOwned$', phunks)),
    map((phunks) => marketStateActions.setOwned({ owned: phunks })),
  ));

  fetchEvents$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketSlug),
    distinctUntilChanged((a, b) => a.marketSlug === b.marketSlug),
    switchMap(({ marketSlug }) => {
      return combineLatest([
        this.store.select(appStateSelectors.selectEventTypeFilter),
        this.store.select(appStateSelectors.selectEventPage)
      ]).pipe(
        // tap(([eventTypeFilter, page]) => console.log('fetchEvents$', {eventTypeFilter, page})),
        switchMap(([eventTypeFilter, page]) =>
          this.dataSvc.fetchEvents(page * 24, 24, eventTypeFilter, marketSlug).pipe(
            map(events => ({ events, page }))
          )
        ),
        scan((acc, { events, page }) => {
          if (page === 0) return events;
          return [...acc, ...events];
        }, [] as Event[]),
      );
    }),
    // tap((events) => console.log('fetchEvents$', events)),
    map((events) => dataStateActions.setEvents({ events })),
  ));

  setActionData$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketData),
    map(({ marketData }) => marketData.filter((item) => !!item.auction)),
    map((auctionData) => auctionData.sort((a, b) => {
      if (a.auction?.endTime && b.auction?.endTime) {
        return new Date(a.auction.endTime).getTime() - new Date(b.auction.endTime).getTime();
      }
      // Handle cases where one or both endTimes are null
      if (a.auction?.endTime && !b.auction?.endTime) return -1;
      if (!a.auction?.endTime && b.auction?.endTime) return 1;
      return 0;
    })),
    map((auctionData) => marketStateActions.setAuctionData({ auctionData })),
  ));

  // Handle pager reset
  resetEventPage$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketSlug),
    distinctUntilChanged((a, b) => a.marketSlug === b.marketSlug),
    switchMap(() => this.store.select(appStateSelectors.selectEventTypeFilter).pipe(
      distinctUntilChanged(),
      map(() => appStateActions.setEventPage({ page: 0 }))
    ))
  ));

  fetchAll$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketSlug),
    distinctUntilChanged((a, b) => a.marketSlug === b.marketSlug),
    switchMap(({ marketSlug }) => {
      return this.dataSvc.fetchAllWithPagination(marketSlug, 0, 110, {}).pipe(
        map((data: MarketState['activeMarketRouteData']) => data.data)
      );
    }),
    map((all: Phunk[]) => marketStateActions.setAll({ all })),
  ));

  paginateAll$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setPagination),
    // distinctUntilChanged((a, b) => a.pagination.fromIndex === b.pagination.fromIndex),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketSlug),
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(marketStateSelectors.selectActiveMarketRouteData),
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
      this.store.select(marketStateSelectors.selectActiveSort),
    ),
    filter(([action, , marketType]) => {
      return marketType === 'all' && (this.defaultFetchLength + 1) <= action.pagination.toIndex;
    }),
    switchMap(([action, marketSlug, marketType, routeData, traitFilters, activeSort]) => {
      return this.dataSvc.fetchAllWithPagination(
        marketSlug,
        action.pagination.fromIndex,
        action.pagination.toIndex,
        traitFilters,
        activeSort
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

  setTraitFilter$ = createEffect(() => this.actions$.pipe(
    ofType(
      marketStateActions.setActiveTraitFilters,
      marketStateActions.setActiveSort
    ),
    withLatestFrom(
      this.store.select(marketStateSelectors.selectMarketType),
      this.store.select(marketStateSelectors.selectMarketSlug),
      this.store.select(marketStateSelectors.selectActiveTraitFilters),
      this.store.select(marketStateSelectors.selectActiveSort),
    ),
    filter(([_, marketType]) => marketType === 'all'),
    // tap(([action, marketType, slug, traitFilters, activeSort]) =>
    //   console.log('setTraitFilter$', {action, marketType, slug, traitFilters, activeSort})
    // ),
    switchMap(([_, __, slug, traitFilters, activeSort]) => {
      return this.dataSvc.fetchAllWithPagination(slug, 0, this.defaultFetchLength, traitFilters, activeSort).pipe(
        mergeMap((data: MarketState['activeMarketRouteData']) => [
          marketStateActions.setActiveMarketRouteData({ activeMarketRouteData: data })
        ]),
      );
    })
  ));

  // fetchMarketStats$ = createEffect(() => this.actions$.pipe(
  //   ofType(marketStateActions.setMarketSlug),
  //   switchMap((action) => this.dataSvc.fetchStats(action.marketSlug).pipe(
  //     tap((stats) => console.log('fetchMarketStats$', action, stats)),
  //   )),
  // ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService
  ) {}

}
