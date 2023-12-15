import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { NavigationTrackerService } from '@/services/nav.service';

import { Phunk } from '@/models/db';
import { MarketTypes } from '@/models/pipes';
import { DataState } from '@/models/data.state';
import { Cooldown, GlobalState, Transaction } from '@/models/global-state';

import { EMPTY, concatMap, delay, distinctUntilChanged, filter, from, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

@Injectable()
export class AppStateEffects {

  setMarketTypeFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    tap((_) => this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }))),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
    ),
    tap(([action, queryParams, routeParams]) => {
      const marketType = routeParams['marketType'];
      if (!marketType) {
        this.store.dispatch(appStateActions.clearActiveTraitFilters());
        this.store.dispatch(dataStateActions.clearActiveMarketRouteData());
      }
    }),
    filter(([_, queryParams, routeParams]) => !!routeParams['marketType']),
    mergeMap(([_, queryParams, routeParams]) => {
      queryParams = { ...queryParams };
      if (queryParams.address) delete queryParams.address;
      return [
        appStateActions.setMarketType({ marketType: routeParams['marketType'] as MarketTypes }),
        appStateActions.setActiveTraitFilters({ activeTraitFilters: queryParams }),
      ];
    }),
  ));

  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setMarketType),
    // distinctUntilChanged(),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParam('address'))
    ),
    switchMap(([action, queryAddress]) => {
      const marketType = action.marketType;
      if (!marketType) return from([]);

      if (queryAddress) {
        return this.store.select(appStateSelectors.selectWalletAddress).pipe(
          switchMap((res) => {
            if (res && res === queryAddress?.toLowerCase()) {
              if (marketType === 'bids') return this.store.select(dataStateSelectors.selectUserOpenBids);
              return this.store.select(dataStateSelectors.selectOwnedPhunks);
            } else {
              return this.dataSvc.fetchOwned(queryAddress);
            }
          })
        );
      }

      if (marketType === 'all') return this.store.select(dataStateSelectors.selectAllPhunks);
      if (marketType === 'listings') return this.store.select(dataStateSelectors.selectListings);
      if (marketType === 'bids') return this.store.select(dataStateSelectors.selectBids);
      return this.store.select(dataStateSelectors.selectMarketData);
    }),
    map((data: DataState['activeMarketRouteData']) => dataStateActions.setActiveMarketRouteData({ activeMarketRouteData: data })),
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    tap((action) => {
      const address = action.walletAddress;
      const transactions = JSON.parse(localStorage.getItem(`EtherPhunks_transactions__${address}`) || '[]').filter(
        (txn: Transaction) => txn.type === 'complete' || txn.type === 'event'
      );
      this.store.dispatch(appStateActions.setTransactions({ transactions }));
      this.store.dispatch(appStateActions.checkHasWithdrawal());
      this.store.dispatch(appStateActions.fetchUserPoints());
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

  fetchUserPoints$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.fetchUserPoints),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => from(this.web3Svc.getUserPoints(address))),
    map((userPoints) => appStateActions.setUserPoints({ userPoints }))
  ));

  menuActive$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.setMenuActive,
      appStateActions.setTheme
    ),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMenuActive),
      this.store.select(appStateSelectors.selectTheme)
    ),
    tap(([_, menuActive, theme]) => {
      const activeTheme = (this.themeSvc.themeStyles as any)[theme];
      if (!document.documentElement.style.getPropertyValue('--header-text')) return;
      document.documentElement.style.setProperty(
        '--header-text',
        menuActive ? activeTheme['--header-text-active'] : activeTheme['--header-text']
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
      // document.documentElement.style.setProperty(
      //   '--header-text',
      //   menuActive ? '255, 255, 255' : (this.themeSvc.themeStyles as any)[theme]['--header-text']
      // );
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

  onNewBlockCheckCooldown$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.newBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectCooldowns)),
    tap(([action, cooldowns]) => this.setCooldowns(action, cooldowns)),
  ), { dispatch: false });

  onTransactionEvent$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.upsertTransaction,
      appStateActions.removeTransaction
    ),
    withLatestFrom(
      this.store.select(appStateSelectors.selectTransactions),
      this.store.select(appStateSelectors.selectWalletAddress),
    ),
    tap(([_, transactions, address]) => localStorage.setItem(
      `EtherPhunks_transactions__${address}`,
      JSON.stringify(transactions.filter((txn: Transaction) => txn.type === 'complete' || txn.type === 'event')))
    ),
    concatMap(([action]) =>
      action.type === '[App State] Upsert Transaction'
      && (
        action.transaction.type === 'complete'
        || action.transaction.type === 'error'
      ) ?
      of(action).pipe(
        delay(5000),
        withLatestFrom(this.store.select(appStateSelectors.selectNotifHoverState)),
        tap(([action, notifHoverState]) => {
          if (!notifHoverState[action.transaction.id]) {
            this.store.dispatch(appStateActions.removeTransaction({ txId: action.transaction.id }));
          }
        })
      ) :
      EMPTY
    )
  ), { dispatch: false });

  onMouseUp$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.mouseUp),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMenuActive),
      this.store.select(appStateSelectors.selectSlideoutActive),
    ),
    tap(([action, menuActive, slideoutActive]) => {

      const slideout = document.querySelector('app-slideout') as HTMLElement;
      const menu = document.querySelector('app-menu') as HTMLElement;
      const header = document.querySelector('app-header') as HTMLElement;
      const target = action.event.target as HTMLElement;

      if (
        menuActive
        && !menu?.contains(target)
        && !header.contains(target)
      ) {
        this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
      }

      if (
        slideoutActive
        && !slideout?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: false }));
      }

    }),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private dataSvc: DataService,
    private location: Location,
    private themeSvc: ThemeService,
    private router: Router,
    private navSvc: NavigationTrackerService
  ) {}

  checkUserEvent(newData: any, address: string): boolean {
    const userMatches = Object.values(newData).filter((item: any) => item === address);
    return !!userMatches.length;
  }

  checkHashIdEvent(newData: any, singlePhunk: Phunk): boolean {
    if (!singlePhunk) return false;
    return newData.hashId === singlePhunk.hashId;
  }

  setCooldowns(action: any, cooldowns: Cooldown[]) {
    const currentBlock = action.blockNumber;
    for (const cooldown of cooldowns) {
      const cooldownEnd = cooldown.startBlock + this.web3Svc.maxCooldown;
      if (currentBlock >= cooldownEnd) {
        this.store.dispatch(appStateActions.removeCooldown({ phunkId: cooldown.phunkId }));
      }
    }
    localStorage.setItem('EtherPhunks_cooldowns', JSON.stringify(cooldowns));
  }
}
