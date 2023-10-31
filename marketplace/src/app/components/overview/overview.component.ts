import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { DataService } from '@/services/data.service';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { GlobalState, TxFilterItem } from '@/models/global-state';

import { BehaviorSubject, Subject, tap } from 'rxjs';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,

    WalletAddressDirective,

    TokenIdParsePipe,
    WeiToEthPipe,
    CalcPipe,
    FormatCashPipe
  ],
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class TxOverviewComponent {

  txFilters: TxFilterItem[] = [
    { label: 'All', value: 'All' },
    { label: 'Created', value: 'created' },
    { label: 'Transferred', value: 'transfer' },
    { label: 'Sale', value: 'PhunkBought' },
    { label: 'Bid Entered', value: 'PhunkBidEntered' },
    { label: 'Bid Withdrawn', value: 'PhunkBidWithdrawn' },
    { label: 'Offered', value: 'PhunkOffered' },
    { label: 'Offer Withdrawn', value: 'PhunkOfferWithdrawn' },
  ];

  _activeTxFilter: string = this.txFilters[0].value;
  // private activeTxFilter = new BehaviorSubject<TxFilterItem>(this.txFilters[0]);
  // activeTxFilter$ = this.activeTxFilter.asObservable();

  labels: any = {
    BidEntered: 'New bid of',
    BidWithdrawn: 'Bid withdrawn',
    OfferWithdrawn: 'Offer withdrawn',
    Offered: 'Offered for',
    sale: 'Bought for',
    transfer: 'Transferred to',
  };

  events$ = this.store.select(dataStateSelectors.selectEvents);

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService
  ) {}

  trackByFn(i: number, item: any): string {
    return item.tokenId;
  }

  setActiveTxFilter(filter: TxFilterItem): void {
    this.store.dispatch(appStateActions.setEventType({ eventType: filter.value }));
    // console.log('setActiveTxFilter', filter);
    // this.activeTxFilter.next(filter);
  }
}
