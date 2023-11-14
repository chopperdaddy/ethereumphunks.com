import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/shared/phunk-grid/phunk-grid.component';
import { TxOverviewComponent } from '@/components/overview/overview.component';
import { SplashComponent } from '@/components/splash/splash.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
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
    FormsModule,
    ReactiveFormsModule,
    LazyLoadImageModule,
    IntersectionObserverModule,

    SplashComponent,
    PhunkGridComponent,
    TxOverviewComponent,

    WeiToEthPipe,
    CalcPipe,
    TokenIdParsePipe
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  phunkBoxLoading: boolean = false;
  phunkBoxError: boolean = false;

  phunkBox: FormGroup = new FormGroup({
    addressInput: new FormControl()
  });

  randomPhunks: string[] = [ '7209', ...Array.from({length: 9}, () => `${Math.floor(Math.random() * 10000)}`)];

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  allPhunks$ = this.store.select(dataStateSelectors.selectAllPhunks);
  // marketData$ = this.store.select(state => state.appState.marketData);

  ownedPhunks$ = this.store.select(dataStateSelectors.selectOwnedPhunks);
  listings$ = this.store.select(dataStateSelectors.selectListings);
  bids$ = this.store.select(dataStateSelectors.selectBids);
  theme$ = this.store.select(appStateSelectors.selectTheme);
  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    private router: Router
  ) {
    this.store.dispatch(dataStateActions.fetchMarketData());
    this.store.dispatch(dataStateActions.fetchAllPhunks());
  }

  async onSubmit($event: any): Promise<void> {
    try {
      this.phunkBoxLoading = true;

      const addressInput  = this.phunkBox?.value?.addressInput;
      let address = addressInput;

      const isEns = addressInput?.includes('.eth');
      const isAddress = this.web3Svc.verifyAddress(addressInput);
      const isTokenId = Number(addressInput) < 10000 && Number(addressInput) > 0;

      if (!isEns && !isAddress && !isTokenId) throw new Error('Invalid Address');

      if (isTokenId) {
        this.router.navigate(['/', 'details', addressInput]);
        this.phunkBoxLoading = false;
        return;
      }

      if (isEns) address = await this.web3Svc.getEnsOwner(addressInput);
      else address = this.web3Svc.verifyAddress(addressInput);

      if (address) this.router.navigate(['/', 'owned'], { queryParams: { address }});
      else throw new Error('Invalid Address');

      this.phunkBoxLoading = false;

    } catch (error) {
      console.log(error);
      this.phunkBoxLoading = false;
      this.phunkBoxError = true;
    }
  }
}
