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

import { selectTxHistory } from '@/state/selectors/app-state.selector';
import { clearTxHistory, fetchTxHistory } from '@/state/actions/app-state.action';

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

  tokenSales$ = this.store.select(selectTxHistory);

  constructor(
    private store: Store<GlobalState>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    console.log('TxHistoryComponent', changes);
    this.store.dispatch(fetchTxHistory({ hashId: changes.hashId.currentValue }));
  }

  ngOnDestroy(): void {
    this.store.dispatch(clearTxHistory());
  }
}
