import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';

import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, of, switchMap, tap } from 'rxjs';

import { Auction, AuctionBid } from '@/models/db';

import { DataService } from '@/services/data.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { environment } from '@environments/environment';

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

  auction = input<Auction | null>();
  auctionBids = input<AuctionBid[] | null>();

  bidsLength = output<number>();

  viewAllBids = signal(false);

  constructor(
    public dataSvc: DataService
  ) {}

}
