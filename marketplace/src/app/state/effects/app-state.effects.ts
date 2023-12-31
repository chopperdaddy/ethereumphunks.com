import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { DataState } from '@/models/data.state';
import { Cooldown, GlobalState, Notification } from '@/models/global-state';

import { EMPTY, concatMap, delay, filter, from, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { environment } from 'src/environments/environment';

@Injectable()
export class AppStateEffects {

  setMarketTypeFromRoute$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    withLatestFrom(this.store.select(getRouterSelectors().selectRouteParams)),
    tap(([action, routeParams]) => {
      this.store.dispatch(appStateActions.setMarketType({ marketType: routeParams['marketType'] }));
      this.store.dispatch(appStateActions.setMarketSlug({ marketSlug: routeParams['slug'] || 'ethereum-phunks' }));
    })
  ), { dispatch: false });

  routerNavigation$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    tap((_) => {
      this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
      this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: false }));
      this.store.dispatch(appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }));
    }),
    withLatestFrom(
      this.store.select(getRouterSelectors().selectQueryParams),
      this.store.select(getRouterSelectors().selectRouteParams),
    ),
    filter(([_, queryParams, routeParams]) => !!routeParams['marketType']),
    map(([_, queryParams, routeParams]) => {
      queryParams = { ...queryParams };
      if (queryParams.address) delete queryParams.address;
      return appStateActions.setActiveTraitFilters({ activeTraitFilters: queryParams });
    }),
  ));

  // Set active market data based on market type
  onMarketTypeChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setMarketType),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMarketType),
      this.store.select(getRouterSelectors().selectRouteParam('slug')),
      this.store.select(getRouterSelectors().selectQueryParam('address')),
    ),
    switchMap(([action, marketType, marketSlug, queryAddress]) => {

      // Likely exited market route so we clear some state
      if (!marketType) {
        this.store.dispatch(appStateActions.clearActiveTraitFilters());
        this.store.dispatch(dataStateActions.clearActiveMarketRouteData());
        return from([]);
      }

      if (queryAddress) {
        return this.store.select(appStateSelectors.selectWalletAddress).pipe(
          switchMap((res) => {
            if (res && res === queryAddress?.toLowerCase()) {
              if (marketType === 'bids') return this.store.select(dataStateSelectors.selectUserOpenBids);
              return this.store.select(dataStateSelectors.selectOwnedPhunks);
            } else {
              return this.dataSvc.fetchOwned(queryAddress, marketSlug);
            }
          })
        );
      }

      if (marketType === 'all') return this.store.select(dataStateSelectors.selectAllPhunks);

      if (marketType === 'listings') return this.store.select(dataStateSelectors.selectListings);
      if (marketType === 'bids') return this.store.select(dataStateSelectors.selectBids);

      // Default to listings
      return this.store.select(dataStateSelectors.selectListings);
    }),
    map((data: DataState['activeMarketRouteData']) => dataStateActions.setActiveMarketRouteData({ activeMarketRouteData: data })),
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    tap((action) => {
      const address = action.walletAddress;
      const notifications = JSON.parse(
        localStorage.getItem(`EtherPhunks_txns__${environment.chainId}__${address}`) || '[]')
          .filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'
      );
      this.store.dispatch(appStateActions.setNotifications({ notifications }));
      this.store.dispatch(appStateActions.checkHasWithdrawal());
      this.store.dispatch(appStateActions.fetchUserPoints());
      // this.store.dispatch(dataStateActions.fetchOwnedPhunks());
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

  fetchActiveMultiplier$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.fetchActiveMultiplier),
    switchMap(() => from(this.web3Svc.getMultiplier())),
    map((activeMultiplier) => appStateActions.setActiveMultiplier({ activeMultiplier: Number(activeMultiplier) }))
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

  onNotificationEvent$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.upsertNotification,
      appStateActions.removeNotification
    ),
    withLatestFrom(
      this.store.select(appStateSelectors.selectNotifications),
      this.store.select(appStateSelectors.selectWalletAddress),
    ),
    tap(([_, notifications, address]) => localStorage.setItem(
      `EtherPhunks_txns__${environment.chainId}__${address}`,
      JSON.stringify(notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event')))
    ),
    concatMap(([action]) =>
      action.type === '[App State] Upsert Notification'
      && (
        action.notification.type === 'complete'
        || action.notification.type === 'error'
      ) ?
      of(action).pipe(
        delay(5000),
        withLatestFrom(this.store.select(appStateSelectors.selectNotifHoverState)),
        tap(([action, notifHoverState]) => {
          if (!notifHoverState[action.notification.id]) {
            this.store.dispatch(appStateActions.removeNotification({ txId: action.notification.id }));
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
    private themeSvc: ThemeService
  ) {}

  setCooldowns(action: any, cooldowns: Cooldown[]) {
    const currentBlock = action.blockNumber;
    for (const cooldown of cooldowns) {
      const cooldownEnd = cooldown.startBlock + this.web3Svc.maxCooldown;
      if (currentBlock >= cooldownEnd) {
        this.store.dispatch(appStateActions.removeCooldown({ hashId: cooldown.hashId }));
      }
    }
    localStorage.setItem('EtherPhunks_cooldowns', JSON.stringify(cooldowns));
  }
}
