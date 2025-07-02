import { Component, ElementRef, input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { DataService } from '@/services/data.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { EventType, GlobalState, TxFilterItem } from '@/models/global-state';

import * as dataStateSelectors from '@/state/data/data-state.selectors';
import * as appStateActions from '@/state/app/app-state.actions';
import * as appStateSelectors from '@/state/app/app-state.selectors';

import { Collection } from '@/models/data.state';
import { firstValueFrom, tap } from 'rxjs';

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
    WeiToEthPipe,
  ],
  selector: 'app-recent-activity',
  templateUrl: './recent-activity.component.html',
  styleUrls: ['./recent-activity.component.scss']
})
export class RecentActivityComponent {

  @ViewChild('scroller') scroller!: ElementRef<HTMLDivElement>;

  collection = input.required<Collection | null>();

  txFilters: TxFilterItem[] = [
    { label: 'All', value: 'All' },
    { label: 'Offered', value: 'PhunkOffered' },
    { label: 'Sold', value: 'PhunkBought' },
    { label: 'Transferred', value: 'transfer' },
    { label: 'Created', value: 'created' },
    { label: 'Auction Created', value: 'AuctionCreated' },
    { label: 'Auction Bid', value: 'AuctionBid' },
    { label: 'Auction Settled', value: 'AuctionSettled' },
    // { label: 'Bid Entered', value: 'PhunkBidEntered' },
    // { label: 'Bid Withdrawn', value: 'PhunkBidWithdrawn' },
    // { label: 'Bridged', value: 'bridgeOut' },
    // { label: 'Bridged', value: 'bridgeIn' },

    // { label: 'Escrowed', value: 'escrow' },
    // { label: 'Offer Withdrawn', value: 'PhunkOfferWithdrawn' },
  ];

  _activeTxFilter: EventType = this.txFilters[0].value;

  labels: any = {
    PhunkOffered: 'Offered',
    PhunkBought: 'Bought',
    transfer: 'Transferred to',
    created: 'Created by',
    bridgeOut: 'Bridged (Locked) by',
    bridgeIn: 'Bridged (Unlocked) by',
    AuctionCreated: 'Auction Created by',
    AuctionBid: 'Auction Bid',
    AuctionSettled: 'Auction Settled',
    // escrow: 'Escrowed by',
    // PhunkNoLongerForSale: 'Offer withdrawn',
  };

  usd$ = this.store.select(dataStateSelectors.selectUsd);
  events$ = this.store.select(dataStateSelectors.selectEvents);

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService
  ) {
    this.store.dispatch(appStateActions.setEventTypeFilter({ eventTypeFilter: this._activeTxFilter }));
  }

  setActiveTxFilter(filter: TxFilterItem): void {
    this.store.dispatch(appStateActions.setEventTypeFilter({ eventTypeFilter: filter.value }));
    this.scroller?.nativeElement?.scrollTo({ left: 0, top: 0 });
  }

  async paginateEvents() {
    const page$ = this.store.select(appStateSelectors.selectEventPage);
    const page = await firstValueFrom(page$);
    // console.log('paginateEvents', page, page + 1);
    this.store.dispatch(appStateActions.setEventPage({ page: page + 1 }));
  }

  resetPagination() {
    this.store.dispatch(appStateActions.setEventPage({ page: 0 }));
    this.scroller?.nativeElement?.scrollTo({ left: 0, top: 0 });
  }
}
