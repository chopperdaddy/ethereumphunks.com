import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { TimeagoModule } from 'ngx-timeago';

import { Store } from '@ngrx/store';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { DataService } from '@/services/data.service';

import { EventType, GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { environment } from '@environments/environment';
import { ZERO_ADDRESS } from '@/constants/utils';

import { BehaviorSubject, catchError, filter, map, of, switchMap, tap } from 'rxjs';

type EventLabels = {
  [type in EventType]: string;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,
    LazyLoadImageModule,

    WalletAddressDirective,

    WeiToEthPipe,
  ],
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss']
})

export class TxHistoryComponent implements OnChanges {

  ZERO_ADDRESS = ZERO_ADDRESS;
  explorerUrl = environment.explorerUrl;

  @Input() phunk!: Phunk;

  private fetchTxHistory = new BehaviorSubject<string | null>(null);
  fetchTxHistory$ = this.fetchTxHistory.asObservable();

  tokenSales$ = this.fetchTxHistory$.pipe(
    filter((hashId) => !!hashId),
    switchMap((hashId) => this.dataSvc.fetchSingleTokenEvents(hashId!)),
    catchError(error => {
      console.error('Error fetching transaction history', error);
      return of(null);
    })
  );

  eventLabels: Partial<EventLabels> = {
    created: 'Created',
    transfer: 'Transfer',
    escrow: 'Escrow',
    PhunkOffered: 'Offered',
    PhunkBidEntered: 'Bid Entered',
    PhunkBidWithdrawn: 'Bid Withdrawn',
    PhunkBought: 'Bought',
    PhunkNoLongerForSale: 'Offer Withdrawn',
    bridgeOut: 'Lock',
    bridgeIn: 'Unlock',
    AuctionCreated: 'Auction Created',
    AuctionBid: 'Auction Bid',
    AuctionExtended: 'Auction Extended',
    AuctionSettled: 'Auction Settled',
  };

  constructor(
    private store: Store<GlobalState>,
    private dataSvc: DataService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.phunk && changes.phunk.currentValue) {
      this.fetchTxHistory.next(this.phunk.hashId);
    }
  }
}
