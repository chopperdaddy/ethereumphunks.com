import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IntersectionObserverModule, IntersectionObserverService } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/shared/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { CalcPipe } from '@/pipes/calculate.pipe';
import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { GlobalState } from '@/models/global-state';

import * as dataStateActions from '@/state/actions/data-state.actions';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    IntersectionObserverModule,

    SplashComponent,
    PhunkGridComponent,
    RecentActivityComponent,

    WeiToEthPipe,
    CalcPipe,
    TokenIdParsePipe
  ],
  providers: [
    // IntersectionObserverService,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  randomPhunks: string[] = [ '7209', ...Array.from({length: 9}, () => `${Math.floor(Math.random() * 10000)}`)];

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  allPhunks$ = this.store.select(dataStateSelectors.selectAllPhunks);
  // marketData$ = this.store.select(state => state.appState.marketData);

  ownedPhunks$ = this.store.select(dataStateSelectors.selectOwnedPhunks);
  listings$ = this.store.select(dataStateSelectors.selectListings);
  bids$ = this.store.select(dataStateSelectors.selectBids);
  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  constructor(
    // @Inject(IntersectionObserverService) entries$: IntersectionObserverService,
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
  ) {
    // this.store.dispatch(dataStateActions.fetchMarketData());
    // this.store.dispatch(dataStateActions.fetchAllPhunks());

    // entries$.subscribe(entries => {
    //   console.log('entries', entries);
    // })
  }

  onIntersection($event: any): void {
    // console.log('onIntersection', $event);
    // this.store.dispatch(appStateActions.setIsVisible({ isVisible: visible }));
  }
}
