import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION, getRouterSelectors } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';

import { GlobalState, Notification } from '@/models/global-state';

import { EMPTY, concatMap, delay, filter, from, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as marketStateActions from '@/state/actions/market-state.actions';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';

import { environment } from 'src/environments/environment';

@Injectable()
export class AppStateEffects {

  routerNavigation$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    mergeMap(() => [
      appStateActions.setMenuActive({ menuActive: false }),
      appStateActions.setSlideoutActive({ slideoutActive: false }),
      appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }),
    ])
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

  onNewBlockCheckCooldown$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setCurrentBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectCooldowns)),
    map(([action, cooldowns]) => {
      let cooldownsCopy = { ...cooldowns };
      Object.keys(cooldowns).forEach(hashId => {
        if (action.currentBlock >= (cooldowns[hashId] + this.web3Svc.maxCooldown)) {
          delete cooldownsCopy[hashId];
        }
      });
      return appStateActions.setCooldowns({ cooldowns: cooldownsCopy });
    })
  ));

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
        tap(() => this.store.dispatch(appStateActions.checkHasWithdrawal())),
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
      this.store.select(appStateSelectors.selectSearchHistoryActive),
    ),
    tap(([action, menuActive, slideoutActive, searchHistoryActive]) => {

      const slideout = document.querySelector('app-slideout') as HTMLElement;
      const menu = document.querySelector('app-menu') as HTMLElement;
      const header = document.querySelector('app-header') as HTMLElement;
      const search = document.querySelector('app-search') as HTMLElement;
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

      if (
        searchHistoryActive
        && !search?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: false }));
      }
    }),
  ), { dispatch: false });

  onSearchHistoryClear = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.clearSearchHistory,
      appStateActions.addSearchHistory,
      appStateActions.removeSearchHistory,
    ),
    withLatestFrom(this.store.select(appStateSelectors.selectSearchHistory)),
    map(([action, searchHistory]) => {
      localStorage.setItem('EtherPhunks_searchHistory', JSON.stringify(searchHistory));
      return appStateActions.setSearchHistory({ searchHistory });
    })
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private themeSvc: ThemeService
  ) {}
}
