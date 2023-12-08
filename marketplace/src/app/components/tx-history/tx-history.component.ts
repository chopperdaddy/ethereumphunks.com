import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { CamelCase2TitleCase } from '@/pipes/cc2tc.pipe';

import { GlobalState } from '@/models/global-state';

import { environment } from 'src/environments/environment';
import { ZERO_ADDRESS } from '@/constants/utils';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { map } from 'rxjs';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule,

    LazyLoadImageModule,

    WalletAddressDirective,

    WeiToEthPipe,
    FormatCashPipe,
    CamelCase2TitleCase
  ],
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss']
})

export class TxHistoryComponent implements OnChanges, OnDestroy {

  ZERO_ADDRESS = ZERO_ADDRESS;
  explorerUrl = `https://${environment.chainId === 5 ? 'goerli.' : ''}etherscan.io`;

  @Input() hashId!: string | undefined;

  tokenSales$ = this.store.select(dataStateSelectors.selectTxHistory).pipe(
    map((data) => data?.map((tx) => ({
      ...tx,
      type: tx.type === 'transfer' && tx.to.toLowerCase() === environment.marketAddress ? 'escrow' : tx.type,
    }))),
  );

  constructor(
    private store: Store<GlobalState>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.store.dispatch(dataStateActions.fetchTxHistory({ hashId: changes.hashId.currentValue }));
  }

  ngOnDestroy(): void {
    this.store.dispatch(dataStateActions.clearTxHistory());
  }
}
