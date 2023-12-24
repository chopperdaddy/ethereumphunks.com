import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

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
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

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
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  collectionSlug$ = this.store.select(appStateSelectors.selectMarketSlug);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  ownedPhunks$ = this.store.select(dataStateSelectors.selectOwnedPhunks);
  listings$ = this.store.select(dataStateSelectors.selectListings);
  bids$ = this.store.select(dataStateSelectors.selectBids);
  allPhunks$ = this.store.select(dataStateSelectors.selectAllPhunks);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
  ) {}
}
