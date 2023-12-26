import { Component, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { GlobalState } from '@/models/global-state';

import { HeaderComponent } from '@/components/header/header.component';
import { FooterComponent } from '@/components/footer/footer.component';
import { MenuComponent } from '@/components/menu/menu.component';
import { TxModalComponent } from '@/components/tx-modal/tx-modal.component';
import { StatusBarComponent } from '@/components/status-bar/status-bar.component';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { debounceTime, filter, observeOn, scan, tap } from 'rxjs/operators';
import { asyncScheduler, fromEvent, Observable } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateActions from '@/state/actions/data-state.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    IntersectionObserverModule,

    MenuComponent,
    HeaderComponent,
    FooterComponent,
    TxModalComponent,
    StatusBarComponent
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private router: Router
  ) {
    this.store.dispatch(appStateActions.setTheme({ theme: 'initial' }));

    this.store.dispatch(dataStateActions.fetchCollections());
    this.store.dispatch(dataStateActions.fetchLeaderboard());
    this.store.dispatch(appStateActions.fetchActiveMultiplier());

    this.store.dispatch(dataStateActions.fetchMarketData());

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

    fromEvent(window, 'resize').pipe(
      debounceTime(500),
      tap(() => this.setIsMobile())
    ).subscribe();

    this.setIsMobile();
  }

  setIsMobile(): void {
    this.store.dispatch(appStateActions.setIsMobile({ isMobile: window.innerWidth < 801 }))
  }

  // @HostListener('document:keydown.escape', ['$event'])
  // keydownHandler($event: KeyboardEvent) {
  //   this.stateSvc.setKeydownEscape($event);
  // }
}
