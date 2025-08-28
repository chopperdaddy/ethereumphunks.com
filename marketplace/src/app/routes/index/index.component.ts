import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { filter, map } from 'rxjs';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';
import { BrbComponent } from '@/components/brb/brb.component';
import { MintComponent } from '@/components/mint/mint.component';
import { AuctionsComponent } from '@/components/auctions/auctions.component';

import { CalcPipe } from '@/pipes/calculate.pipe';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { GlobalState } from '@/models/global-state';
import { SortOption } from '@/models/sorts.model';

import * as dataStateSelectors from '@/state/data/data-state.selectors';
import * as appStateSelectors from '@/state/app/app-state.selectors';
import * as marketStateSelectors from '@/state/market/market-state.selectors';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    WaIntersectionObserver,

    SplashComponent,
    PhunkGridComponent,
    RecentActivityComponent,
    BrbComponent,
    MintComponent,
    AuctionsComponent,

    CalcPipe,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  owned$ = this.store.select(marketStateSelectors.selectOwned);
  listings$ = this.store.select(marketStateSelectors.selectListings);
  bids$ = this.store.select(marketStateSelectors.selectBids);
  all$ = this.store.select(marketStateSelectors.selectAll);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  config$ = this.store.select(appStateSelectors.selectConfig);

  mintImage = signal<string | null>(null);
  auctionImage = signal<string | null>(null);

  auctions$ = this.store.select(marketStateSelectors.selectAuctions);

  SortOption = SortOption;

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public route: ActivatedRoute
  ) {}
}
