import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { DataService } from '@/services/data.service';
import { LogItem, SocketService } from '@/services/socket.service';

import { GlobalState, LinkedAccount } from '@/models/global-state';

import { catchError, EMPTY, filter, from, map, mergeMap, of, scan, startWith, switchMap, take, tap, withLatestFrom, takeUntil } from 'rxjs';

import * as appStateActions from '@/state/app/app-state.actions';
import * as appStateSelectors from '@/state/app/app-state.selectors';

import { ChatService } from '@/services/chat.service';

import { environment } from '@environments/environment';
import { formatEther } from 'viem';
import { StorageService } from '@/services/storage.service';
@Injectable()
export class AppStateEffects {

  globalConfig$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.initGlobalConfig),
    switchMap(() => {
      return this.dataSvc.fetchGlobalConfig().pipe(
        switchMap((config) => {
          return from(this.web3Svc.checkContractPaused()).pipe(
            map((paused) => {
              const newConfig = {
                ...config,
                maintenance: paused || config.maintenance,
              };
              console.table(newConfig);
              return appStateActions.setGlobalConfig({ config: newConfig });
            })
          )
        })
      )
    })
  ));

  routerNavigation$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    mergeMap(() => [
      appStateActions.setMenuActive({ menuActive: false }),
      appStateActions.setSlideoutActive({ slideoutActive: false }),
      appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }),
      appStateActions.setCollectionsMenuActive({ collectionsMenuActive: false }),
    ])
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter(({ walletAddress }) => !!walletAddress),
    mergeMap(({ walletAddress }) => {
      const address = walletAddress?.toLowerCase();
      return [
        appStateActions.fetchUserPoints({ address }),
        appStateActions.checkHasWithdrawal()
      ];
    }),
  ));

  checkIsBanned$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter((action) => !!action.walletAddress),
    switchMap((action) => this.dataSvc.checkIsBanned(action.walletAddress!)),
    map(isBanned => appStateActions.setIsBanned({ isBanned })),
  ));

  checkHasWithdrawal$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.checkHasWithdrawal),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => {
      return from(this.web3Svc.checkHasWithdrawal(address!)).pipe(
        map(hasWithdrawal => Number(formatEther(hasWithdrawal))),
        catchError(() => of(0)),
      );
    }),
    map(hasWithdrawal => appStateActions.setHasWithdrawal({ hasWithdrawal })),
  ));

  fetchUserPoints$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.fetchUserPoints),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!action.address && action.address === address),
    switchMap(([action, address]) => from(this.web3Svc.getUserPoints(address!))),
    map((userPoints) => appStateActions.setUserPoints({ userPoints }))
  ));

  pointsChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.pointsChanged),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!action.log?.args?.user && action.log.args.user.toLowerCase() === address),
    map(([action, address]) => appStateActions.fetchUserPoints({ address }))
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
        if (action.currentBlock >= (cooldowns[hashId] + this.web3Svc.minCooldown)) {
          delete cooldownsCopy[hashId];
        }
      });
      return appStateActions.setCooldowns({ cooldowns: cooldownsCopy });
    })
  ));

  onMouseDown$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.mouseDown),
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
      const collectionsMenu = document.querySelector('app-collections-dropdown') as HTMLElement;
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
        searchHistoryActive &&
        !search?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: false }));
      }

      if (
        !collectionsMenu?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setCollectionsMenuActive({ collectionsMenuActive: false }));
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
      localStorage.setItem(`EtherPhunks_searchHistory_${environment.chainId}`, JSON.stringify(searchHistory));
      return appStateActions.setSearchHistory({ searchHistory });
    })
  ));

  onSetLinkedAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter(({ walletAddress }) => !!walletAddress),
    switchMap(({ walletAddress }) => {
      return from(this.storageSvc.getItem<LinkedAccount[]>('accounts')).pipe(
        filter((accounts) => !accounts?.find(account => account.address === walletAddress!)),
        map((accounts) => {
          const newLinkedAccounts = [...(accounts || []), { address: walletAddress! }];
          return appStateActions.setLinkedAccounts({ linkedAccounts: newLinkedAccounts });
        }),
        // tap((action) => console.log({ action }))
      );
    }),
  ));

  setLinkedAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setLinkedAccounts),
    switchMap((action) => {
      return from(this.storageSvc.setItem('accounts', action.linkedAccounts)).pipe(
        tap(() => {
          this.socketSvc.sendMessage('accounts', JSON.stringify(action.linkedAccounts.map(account => account.address)));
        })
      );
    }),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private themeSvc: ThemeService,
    private chatSvc: ChatService,
    private dataSvc: DataService,
    private socketSvc: SocketService,
    private storageSvc: StorageService,
  ) {
    // Initialize browser activity tracking
    this.initBrowserActivityTracking();
  }

  private initBrowserActivityTracking(): void {
    // Listen for Page Visibility API changes
    document.addEventListener('visibilitychange', () => {
      const isVisible = !document.hidden;
      this.store.dispatch(appStateActions.setBrowserActive({ isBrowserActive: isVisible }));
    });

    // Listen for window focus/blur events (backup for older browsers)
    window.addEventListener('focus', () => {
      this.store.dispatch(appStateActions.setBrowserActive({ isBrowserActive: true }));
    });

    window.addEventListener('blur', () => {
      this.store.dispatch(appStateActions.setBrowserActive({ isBrowserActive: false }));
    });

    // Set initial state based on current visibility
    const initiallyActive = !document.hidden && document.hasFocus();
    this.store.dispatch(appStateActions.setBrowserActive({ isBrowserActive: initiallyActive }));
  }
}
