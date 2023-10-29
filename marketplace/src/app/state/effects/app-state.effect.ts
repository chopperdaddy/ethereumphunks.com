import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { Attribute, Phunk } from '@/models/graph';
import { GlobalState } from '@/models/global-state';
import { MarketTypes } from '@/models/pipes';

import { filter, forkJoin, from, map, mergeMap, switchMap, tap, withLatestFrom } from 'rxjs';

import { environment } from 'src/environments/environment';

import * as actions from '@/state/actions/app-state.action';
import * as selectors from '@/state/selectors/app-state.selector';

import { ThemeService } from '@/services/theme.service';

@Injectable()
export class AppStateEffects {

  setMarketTypeFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    tap((action) => this.store.dispatch(actions.setMenuActive({ menuActive: false }))),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectRouteParam('marketType')),
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
    ),
    tap(([action, marketType, queryParams, routeParams]) => {
      if (!marketType) {
        this.store.dispatch(actions.clearActiveTraitFilters());
        this.store.dispatch(actions.clearActiveMarketRouteData());
        // const phunkId = routeParams['tokenId'];
      }
    }),
    filter(([action, marketType, queryParams]) => !!marketType),
    mergeMap(([action, marketType, queryParams]) => {
      queryParams = { ...queryParams };
      if (queryParams.address) delete queryParams.address;
      return [
        actions.setMarketType({ marketType: marketType as MarketTypes }),
        actions.setActiveTraitFilters({ activeTraitFilters: queryParams }),
      ];
    }),
  ));

  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(actions.setMarketType, actions.dbEventTriggered),
    // tap((action) => console.log('setMarketType', action)),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParam('address')),
      this.store.select(selectors.selectMarketType),
    ),
    switchMap(([action, address, marketType]) => {
      console.log('setMarketType', {action, address, marketType});
      if (address) return this.dataSvc.fetchOwned(address);

      if (action.type === '[App State] DB Event Triggered') {

      }
      if (marketType === 'all') return this.store.select(selectors.selectAllPhunks);
      if (marketType === 'listings') return this.store.select(selectors.selectListings);
      if (marketType === 'bids') return this.store.select(selectors.selectBids);
      return this.store.select(selectors.selectMarketData);
    }),
    map((phunks) => actions.setActiveMarketRouteData({ activeMarketRouteData: phunks || [] })),
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(actions.setWalletAddress),
    tap((action) => {
      // console.log('setWalletAddress', action);
      this.store.dispatch(actions.checkHasWithdrawal());
      this.store.dispatch(actions.fetchOwnedPhunks());
    }),
  ), { dispatch: false });

  dbEventTriggered$ = createEffect(() => this.actions$.pipe(
    ofType(actions.dbEventTriggered),
    // tap((action) => console.log('dbEventTriggered', action)),
    map((action) => action.payload.new as any),
    filter((res) => !!res),
    withLatestFrom(
      this.store.select(selectors.selectSinglePhunk),
      this.store.select(selectors.selectWalletAddress),
      this.store.select(selectors.selectActiveEventType)
    ),
    tap(([newData, singlePhunk, address, activeEventType]) => {
      console.log('dbEventTriggered', {newData, singlePhunk, address, activeEventType});
      this.store.dispatch(actions.refreshSinglePhunk());
      this.store.dispatch(actions.fetchOwnedPhunks());
      this.store.dispatch(actions.fetchMarketData());
      this.store.dispatch(actions.setEventType({ eventType: activeEventType }));
    }),
  ), { dispatch: false });

  fetchEvents$ = createEffect(() => this.actions$.pipe(
    ofType(actions.setEventType),
    // tap((action) => console.log('fetchEvents', action)),
    switchMap((action) => this.dataSvc.fetchEvents(6, action.eventType)),
    map((events) => actions.setEvents({ events })),
  ));

  fetchTxHistory$ = createEffect(() => this.actions$.pipe(
    ofType(actions.fetchTxHistory),
    filter((action) => !!action.hashId),
    switchMap((action) => this.dataSvc.fetchSingleTokenEvents(action.hashId)),
    map((txHistory) => actions.setTxHistory({ txHistory })),
  ));

  addTraitFilter$ = createEffect(() => this.actions$.pipe(
    ofType(actions.addRemoveTraitFilter),
    withLatestFrom(
      this.store.select(selectors.selectActiveTraitFilters),
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

  // FIXME: Type change
  fetchAllPhunks$ = createEffect(() => this.actions$.pipe(
    ofType(actions.fetchAllPhunks),
    switchMap(() => this.dataSvc.getAttributes()),
    map((attributes) => {
      return Object.keys(attributes).map((k) => {
        return {
          hashId: '',
          phunkId: Number(k),
          createdAt: new Date(),
          owner: '',
          prevOwner: '',

          attributes: (attributes as any)[k] as Attribute[],
        };
      });
    }),
    map((phunks) => actions.setAllPhunks({ allPhunks: phunks })),
  ));

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(actions.fetchMarketData),
    switchMap(() => this.dataSvc.fetchMarketData()),
    map(([listings, bids]) => {
      const merged: any = {};

      for (const listing of listings) merged[listing.hashId] = {
        ...merged[listing.hashId],
        phunkId: listing[`phunks${this.dataSvc.prefix}`].phunkId,
        hashId: listing.hashId,
        listing,
      };
      for (const bid of bids) merged[bid.hashId] = {
        ...merged[bid.hashId],
        phunkId: bid[`phunks${this.dataSvc.prefix}`].phunkId,
        hashId: bid.hashId,
        bid,
      };

      const marketData = Object.values(merged);
      return marketData;
    }),
    switchMap((res: any) => this.dataSvc.addAttributes(res)),
    map((marketData: Phunk[]) => {
      const listingsData = marketData.filter((item: any) => item.listing && item.listing.value !== '0');
      const bidsData = marketData.filter((item: any) => item.bid && item.bid.value !== '0');
      return { marketData, listingsData, bidsData, };
    }),
    // tap((res) => console.log('fetchMarketData', res)),
    mergeMap(({ marketData, listingsData, bidsData }) => {
      return [
        actions.setMarketData({ marketData }),
        actions.setListings({ listings: listingsData }),
        actions.setBids({ bids: bidsData })
      ];
    })
  ));

  fetchSinglePhunk$ = createEffect(() => this.actions$.pipe(
    ofType(actions.fetchSinglePhunk),
    // delay(1000),
    switchMap((action) => this.dataSvc.fetchSinglePhunk(action.phunkId)),
    // tap((res) => console.log('fetchSinglePhunk', res)),
    map((phunk: Phunk) => {
      return {
        phunkId: phunk.phunkId,
        createdAt: phunk.createdAt,
        hashId: phunk.hashId,
        owner: phunk.owner,
        prevOwner: phunk.prevOwner,
        isEscrowed: phunk.owner === environment.phunksMarketAddress,
        attributes: [],
      };
    }),
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
      attributes: [ ...(res.attributes || []) ].sort((a: Attribute, b: Attribute) => {
        if (a.k === "Sex") return -1;
        if (b.k === "Sex") return 1;
        return 0;
      }),
    })),
    map((phunk) => actions.setSinglePhunk({ phunk })),
  ));

  refreshSinglePhunk$ = createEffect(() => this.actions$.pipe(
    ofType(actions.refreshSinglePhunk),
    withLatestFrom(this.store.select(selectors.selectSinglePhunk)),
    // tap(([action, phunk]) => console.log('refreshSinglePhunk', action, phunk)),
    filter(([action, phunk]) => !!phunk),
    map(([action, phunk]) => actions.fetchSinglePhunk({ phunkId: `${phunk!.hashId}` })),
  ));

  checkHasWithdrawal$ = createEffect(() => this.actions$.pipe(
    ofType(actions.checkHasWithdrawal),
    withLatestFrom(this.store.select(selectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => from(this.web3Svc.checkHasWithdrawal(address))),
    map(has => actions.setHasWithdrawal({ hasWithdrawal: has })
  )));

  fetchOwnedPhunks$ = createEffect(() => this.actions$.pipe(
    ofType(actions.fetchOwnedPhunks),
    withLatestFrom(this.store.select(selectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => this.dataSvc.fetchOwned(address)),
    map((phunks) => actions.setOwnedPhunks({ ownedPhunks: phunks })),
  ));

  menuActive$ = createEffect(() => this.actions$.pipe(
    ofType(actions.setMenuActive),
    withLatestFrom(this.store.select(selectors.selectTheme)),
    tap(([action, theme]) => {
      const menuActive = action.menuActive;
      document.documentElement.style.setProperty(
        '--header-text',
        menuActive ? '255, 255, 255' : (this.themeSvc.themeStyles as any)[theme]['--header-text']
      );
    }),
  ), { dispatch: false });

  onSetTheme$ = createEffect(() => this.actions$.pipe(
    ofType(actions.setTheme),
    withLatestFrom(this.store.select(selectors.selectMenuActive)),
    tap(([action, menuActive]) => {
      let theme = action.theme;
      if (theme === 'initial') {
        theme = this.themeSvc.getInitialTheme();
        this.store.dispatch(actions.setTheme({ theme }));
        return;
      }
      this.themeSvc.setThemeStyles(theme);

      document.documentElement.style.setProperty(
        '--header-text',
        menuActive ? '255, 255, 255' : (this.themeSvc.themeStyles as any)[theme]['--header-text']
      );
    }),
  ), { dispatch: false });

  onClickExternal$ = createEffect(() => this.actions$.pipe(
    ofType(),
    // merge(
    //   this.stateSvc.keyDownEscape$,
    //   this.stateSvc.documentClick$,
    //   fromEvent<MouseEvent>(this.modal.nativeElement, 'mousedown'),
    //   fromEvent<MouseEvent>(this.modal.nativeElement, 'mouseup')
    // ).pipe(
    //   filter(() => !(this.el.nativeElement as HTMLElement).classList.contains('sidebar')),
    //   tap(($event) => {

    //     const modal = this.modal.nativeElement as HTMLElement;
    //     const target = $event?.target as HTMLElement;

    //     if ($event instanceof KeyboardEvent || (!mouseDownInsideModal && !modal.contains(target))) {
    //       this.closeModal();
    //     }

    //     if ($event.type === 'mousedown' && modal.contains(target)) {
    //       mouseDownInsideModal = true;
    //     } else if ($event.type === 'mouseup') {
    //       mouseDownInsideModal = false;
    //     }
    //   }),
    //   takeUntil(this.destroy$)
    // )
  ), { dispatch: false });

  onNewBlock$ = createEffect(() => this.actions$.pipe(
    ofType(actions.newBlock),
    withLatestFrom(this.store.select(selectors.selectCooldowns)),
    tap(([action, cooldowns]) => {
      console.log('newBlock', {action, cooldowns});
      const currentBlock = action.blockNumber;
      for (const cooldown of cooldowns) {
        const cooldownEnd = cooldown.startBlock + this.web3Svc.maxCooldown;
        if (currentBlock >= cooldownEnd) {
          this.store.dispatch(actions.removeCooldown({ phunkId: cooldown.phunkId }));
        }
      }
      localStorage.setItem('EtherPhunks_cooldowns', JSON.stringify(cooldowns));
    })
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private dataSvc: DataService,
    private location: Location,
    private themeSvc: ThemeService
  ) {}

  checkUserEvent(newData: any, address: string): boolean {
    const userMatches = Object.values(newData).filter((item: any) => item === address);
    return !!userMatches.length;
  }

  checkHashIdEvent(newData: any, singlePhunk: Phunk): boolean {
    if (!singlePhunk) return false;
    return newData.hashId === singlePhunk.hashId;
  }
}
