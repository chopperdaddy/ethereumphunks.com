import { Component, HostListener, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';

import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';

import { Web3Service } from './services/web3.service';
import { DataService } from './services/data.service';
import { ThemeService } from './services/theme.service';

import { debounceTime, filter, observeOn, scan, tap } from 'rxjs/operators';
import { asyncScheduler, fromEvent, Observable } from 'rxjs';

import { GlobalState } from './models/global-state';

import * as actions from './state/actions/app-state.action';
import * as selectors from './state/selectors/app-state.selector';
import { MenuComponent } from './components/menu/menu.component';
import { TxModalComponent } from './components/tx-modal/tx-modal.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    MenuComponent,
    HeaderComponent,
    FooterComponent,
    TxModalComponent
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  isMarketplace$!: Observable<any>;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private router: Router
  ) {

    this.store.dispatch(actions.setEventType({ eventType: 'All' }));
    this.store.dispatch(actions.fetchMarketData());
    this.store.dispatch(actions.fetchAllPhunks());
    this.store.dispatch(actions.setTheme({ theme: 'initial' }));

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
            ...(event instanceof NavigationStart ? { [event.id]: window.pageYOffset || this.document.documentElement.scrollTop } : {}),
          },
          trigger: event instanceof NavigationStart ? event.navigationTrigger : acc.trigger,
          idToRestore: (event instanceof NavigationStart && event.restoredState && event.restoredState.navigationId + 1) || acc.idToRestore,
        };
      }),
      filter(({ event, trigger }) => event instanceof NavigationEnd && !!trigger),
      observeOn(asyncScheduler),
      tap(({ trigger, positions, idToRestore }) => {
        setTimeout(() => {
          if (trigger === 'imperative') this.document.documentElement.scrollTop = 0;
          if (trigger === 'popstate') this.document.documentElement.scrollTop = positions[idToRestore];
        }, 0);
      })
    ).subscribe();

    // fromEvent(this.document, 'mouseup').pipe(
    //   tap(($event: Event) => {
    //     $event.stopPropagation();
    //     this.stateSvc.setDocumentClick($event as MouseEvent);
    //   })
    // ).subscribe();

    fromEvent(window, 'resize').pipe(
      debounceTime(500),
      tap(() => this.store.dispatch(actions.setIsMobile({ isMobile: window.innerWidth < 801 })))
    ).subscribe();
  }

  // @HostListener('document:keydown.escape', ['$event'])
  // keydownHandler($event: KeyboardEvent) {
  //   this.stateSvc.setKeydownEscape($event);
  // }
}
