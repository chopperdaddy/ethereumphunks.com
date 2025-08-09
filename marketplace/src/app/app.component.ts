import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { GlobalState } from '@/models/global-state';

import { HeaderComponent } from '@/components/header/header.component';
import { FooterComponent } from '@/components/footer/footer.component';
import { MenuComponent } from '@/components/menu/menu.component';
import { NotificationsComponent } from '@/components/notifications/notifications.component';
import { StatusBarComponent } from '@/components/status-bar/status-bar.component';
import { ChatComponent } from './components/chat/chat.component';
import { LoggerComponent } from './components/logger/logger.component';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { PwaUpdateService } from '@/services/pwa-update.service';

import { selectConfig, selectIsMobile, selectAdvancedMode } from '@/state/app/app-state.selectors';
import { selectLogsActive } from '@/state/indexer-logs/indexer-logs.selectors';

import * as appStateActions from '@/state/app/app-state.actions';
import * as dataStateActions from '@/state/data/data-state.actions';
import { setChatActive } from '@/state/chat/chat.actions';
import { selectChat } from '@/state/chat/chat.selectors';

import { asyncScheduler, fromEvent, debounceTime, filter, observeOn, scan, tap, withLatestFrom, map, firstValueFrom } from 'rxjs';

import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    WaIntersectionObserver,

    MenuComponent,
    HeaderComponent,
    FooterComponent,
    NotificationsComponent,
    StatusBarComponent,
    ChatComponent,
    LoggerComponent
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {

  env = environment;

  statusBarVisible = signal(true);

  // Target sequence for advanced mode activation
  private readonly targetSequence: string = '8008135';

  chatActive$ = this.store.select(selectChat).pipe(map(({ active }) => active));
  logsActive$ = this.store.select(selectLogsActive);
  config$ = this.store.select(selectConfig);
  advancedMode$ = this.store.select(selectAdvancedMode);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private router: Router,
    private pwaUpdateSvc: PwaUpdateService,
  ) {
    this.store.dispatch(appStateActions.setTheme({ theme: 'initial' }));
    this.store.dispatch(appStateActions.initGlobalConfig());
    this.store.dispatch(dataStateActions.fetchCollections());
    this.store.dispatch(appStateActions.fetchActiveMultiplier());

    this.setStatusBarVisible();
  }

  ngOnInit(): void {
    this.router.events.pipe(
      ////////////////////////
      // Scroll restoration //
      ////////////////////////
      filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd),
      scan((acc: any, event: any) => {
        return {
          event,
          positions: {
            ...acc.positions,
            ...(event instanceof NavigationStart ? { [event.id]: window.scrollY } : {}),
          },
          trigger: event instanceof NavigationStart ? event.navigationTrigger : acc.trigger,
          idToRestore: (event instanceof NavigationStart && event.restoredState && event.restoredState.navigationId + 1) || acc.idToRestore,
        };
      }),
      filter(({ event, trigger }) => event instanceof NavigationEnd && !!trigger),
      observeOn(asyncScheduler),
      tap(({ trigger, positions, idToRestore }) => {
        setTimeout(() => {
          if (trigger === 'imperative') window.scrollTo(0, 0);
          if (trigger === 'popstate') window.scrollTo(0, positions[idToRestore] || 0);
        }, 0);
      })
    ).subscribe();

    fromEvent(this.document, 'mouseup').pipe(
      tap(($event: Event) => {
        $event.stopPropagation();
        this.store.dispatch(appStateActions.mouseUp({ event: $event as MouseEvent }));
      })
    ).subscribe();

    fromEvent(this.document, 'mousedown').pipe(
      tap(($event: Event) => {
        $event.stopPropagation();
        this.store.dispatch(appStateActions.mouseDown({ event: $event as MouseEvent }));
      })
    ).subscribe();

    fromEvent(window, 'resize').pipe(
      debounceTime(100),
      tap(() => {
        this.setIsMobile();
        this.setStatusBarVisible();
      })
    ).subscribe();

    // scroll event
    fromEvent(window, 'scroll').pipe(
      withLatestFrom(this.store.select(selectIsMobile)),
      filter(([_, isMobile]) => !!isMobile),
      tap(([$event, isMobile]) => this.setStatusBarVisible())
    ).subscribe();

        // keydown event for advanced mode activation
    fromEvent(this.document, 'keydown').pipe(
      withLatestFrom(this.advancedMode$),
      filter(([_, advancedMode]) => !advancedMode),
      map(([event, _]) => event as KeyboardEvent),
      filter(event => /^\d$/.test(event.key)),
      map(event => event.key),
      scan((acc: { sequence: string, timestamp: number }, key: string) => {
        const now = Date.now();
        // Reset sequence if more than 2 seconds have passed
        const sequence = now - acc.timestamp > 2000 ? key : acc.sequence + key;
        const trimmedSequence = sequence.length > this.targetSequence.length
          ? sequence.substring(1)
          : sequence;
        return { sequence: trimmedSequence, timestamp: now };
      }, { sequence: '', timestamp: 0 }),
      debounceTime(100),
      tap(({ sequence }) => {
        if (sequence === this.targetSequence) {
          this.store.dispatch(appStateActions.setAdvancedMode({ advancedMode: true }));
console.log(`
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░░░░░░░░░░░░░░░░
░░░░░░░▒▒██░░░░░░▒▒██░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░██░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░██████░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░█▀█░█▀▄░█░█░█▀█░█▀█░█▀▀░█▀▀░█▀▄░░░░░░░░
░░░█▀█░█░█░▀▄▀░█▀█░█░█░█░░░█▀▀░█░█░░░░░░░░
░░░▀░▀░▀▀░░░▀░░▀░▀░▀░▀░▀▀▀░▀▀▀░▀▀░░░░░░░░░
░░░█▄█░█▀█░█▀▄░█▀▀░░░░░░░░░░░░░░░░░░░░░░░░
░░░█░█░█░█░█░█░█▀▀░░░░░░░░░░░░░░░░░░░░░░░░
░░░▀░▀░▀▀▀░▀▀░░▀▀▀░░░░░░░░░░░░░░░░░░░░░░░░
░░░█▀█░█▀▀░▀█▀░▀█▀░█░█░█▀█░▀█▀░█▀▀░█▀▄░░░░
░░░█▀█░█░░░░█░░░█░░▀▄▀░█▀█░░█░░█▀▀░█░█░░░░
░░░▀░▀░▀▀▀░░▀░░▀▀▀░░▀░░▀░▀░░▀░░▀▀▀░▀▀░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`)
        }
      })
    ).subscribe();

    this.setIsMobile();
    this.pwaUpdateSvc.checkForUpdate();
  }

  setIsMobile(): void {
    this.store.dispatch(appStateActions.setIsMobile({ isMobile: window.innerWidth < 801 }))
  }

  setStatusBarVisible() {
    // if (window.innerWidth > 800) {
    //   this.statusBarVisible.set(true);
    // } else {
    //   const scrollY = window.scrollY;
    //   this.statusBarVisible.set(scrollY > 100);
    // }
  }

  async toggleChat() {
    const active = await firstValueFrom(this.chatActive$);
    this.store.dispatch(setChatActive({ active: !active }));
  }

  /**
   * Resets advanced mode (for testing/debugging purposes)
   */
  resetAdvancedMode() {
    this.store.dispatch(appStateActions.setAdvancedMode({ advancedMode: false }));
    console.log('Advanced mode deactivated');
  }
}
