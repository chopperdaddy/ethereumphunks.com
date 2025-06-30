import { CommonModule } from '@angular/common';
import { Component, input, Input, OnInit, output, signal } from '@angular/core';

import { DataService } from '@/services/data.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { environment } from '@environments/environment';

import { FormattedAuction } from '@/models/auctions';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap, tap } from 'rxjs';

@Component({
  standalone: true,
  imports: [
    CommonModule,

    WalletAddressDirective,
    WeiToEthPipe
  ],
  selector: 'app-bid-history',
  templateUrl: './bid-history.component.html',
  styleUrls: ['./bid-history.component.scss']
})

export class BidHistoryComponent {

  explorerUrl = environment.explorerUrl;

  auction = input<FormattedAuction | null>();
  bidsLength = output<number>();

  auctionBids$ = toObservable(this.auction).pipe(
    distinctUntilChanged((a, b) => a?.auctionId === b?.auctionId),
    switchMap((auction) => {
      console.log('BidHistoryComponent', {auction});
      if (!auction) return of([]);
      return this.dataSvc.watchAuctionBids(auction.auctionId);
    }),
    tap((bids) => {
      console.log('BidHistoryComponent', {bids});
      this.bidsLength.emit(bids?.length || 0);
    })
  );

  viewAllBids = signal(false);

  constructor(
    public dataSvc: DataService
  ) {}

}
