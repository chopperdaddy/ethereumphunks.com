import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { Phunk } from '@/models/graph';
import { GlobalState } from '@/models/global-state';
import { MarketTypes } from '@/models/pipes';

import { filter, from, map, mergeMap, switchMap, tap, withLatestFrom } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

@Injectable()
export class AppStateEffects {

  setMarketTypeFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    tap((action) => this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }))),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectRouteParam('marketType')),
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
    ),
    tap(([action, marketType, queryParams, routeParams]) => {
      if (!marketType) {
        this.store.dispatch(appStateActions.clearActiveTraitFilters());
        this.store.dispatch(dataStateActions.clearActiveMarketRouteData());
        // const phunkId = routeParams['tokenId'];
      }
    }),
    filter(([action, marketType, queryParams]) => !!marketType),
    mergeMap(([action, marketType, queryParams]) => {
      queryParams = { ...queryParams };
      if (queryParams.address) delete queryParams.address;
      return [
        appStateActions.setMarketType({ marketType: marketType as MarketTypes }),
        appStateActions.setActiveTraitFilters({ activeTraitFilters: queryParams }),
      ];
    }),
  ));

  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setMarketType, dataStateActions.dbEventTriggered),
    // tap((action) => console.log('setMarketType', action)),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParam('address')),
      this.store.select(appStateSelectors.selectMarketType),
    ),
    switchMap(([action, address, marketType]) => {
      console.log('setMarketType', {action, address, marketType});
      if (address) return this.dataSvc.fetchOwned(address);
      if (marketType === 'all') return this.store.select(dataStateSelectors.selectAllPhunks);
      if (marketType === 'listings') return this.store.select(dataStateSelectors.selectListings);
      if (marketType === 'bids') return this.store.select(dataStateSelectors.selectBids);
      return this.store.select(dataStateSelectors.selectMarketData);
    }),
    map((phunks) => dataStateActions.setActiveMarketRouteData({ activeMarketRouteData: phunks || [] })),
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    tap((action) => {
      // console.log('setWalletAddress', action);
      this.store.dispatch(appStateActions.checkHasWithdrawal());
      this.store.dispatch(dataStateActions.fetchOwnedPhunks());
    }),
  ), { dispatch: false });

  addTraitFilter$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.addRemoveTraitFilter),
    withLatestFrom(
      this.store.select(appStateSelectors.selectActiveTraitFilters),
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

  checkHasWithdrawal$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.checkHasWithdrawal),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => from(this.web3Svc.checkHasWithdrawal(address))),
    map(has => appStateActions.setHasWithdrawal({ hasWithdrawal: has })
  )));

  menuActive$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setMenuActive),
    withLatestFrom(this.store.select(appStateSelectors.selectTheme)),
    tap(([action, theme]) => {
      const menuActive = action.menuActive;
      document.documentElement.style.setProperty(
        '--header-text',
        menuActive ? '255, 255, 255' : (this.themeSvc.themeStyles as any)[theme]['--header-text']
      );
    }),
  ), { dispatch: false });

  onSetTheme$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setTheme),
    withLatestFrom(this.store.select(appStateSelectors.selectMenuActive)),
    tap(([action, menuActive]) => {
      let theme = action.theme;
      if (theme === 'initial') {
        theme = this.themeSvc.getInitialTheme();
        this.store.dispatch(appStateActions.setTheme({ theme }));
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
    ofType(appStateActions.newBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectCooldowns)),
    tap(([action, cooldowns]) => {
      // console.log('newBlock', {action, cooldowns});
      const currentBlock = action.blockNumber;
      for (const cooldown of cooldowns) {
        const cooldownEnd = cooldown.startBlock + this.web3Svc.maxCooldown;
        if (currentBlock >= cooldownEnd) {
          this.store.dispatch(appStateActions.removeCooldown({ phunkId: cooldown.phunkId }));
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
