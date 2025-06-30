import { Component, effect, input, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, switchMap, tap } from 'rxjs';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { TimerComponent } from '@/components/auction/timer/timer.component';
import { BidHistoryComponent } from '@/components/auction/bid-history/bid-history.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { Phunk } from '@/models/db';
import { FormattedAuction, formatAuction, isValidAuction } from '@/models/auctions';


@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,

    TimerComponent,
    BidHistoryComponent,

    WeiToEthPipe
  ],
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.scss']
})

export class AuctionComponent {

  phunk = input<Phunk>();

  auction$ = toObservable(this.phunk).pipe(
    filter((phunk): phunk is Phunk => !!phunk),
    switchMap((phunk) => this.web3Svc.watchAuctionByPrevOwnerAndHashId({
      prevOwner: phunk!.prevOwner!,
      hashId: phunk!.hashId
    })),
    map((auction): FormattedAuction | null => {
      if (!isValidAuction(auction)) {
        return null;
      }
      // Type-safe conversion using the utility function
      return formatAuction(auction);
    })
  );

  bidValue = new FormControl<number | null>(null);

  bidsLength = signal(0);
  auctionComplete = signal(false);

  inputError = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    public web3Svc: Web3Service,
    public dataSvc: DataService,
  ) {}

  async submitBid(): Promise<void> {
    this.closeError();

    try {
      const phunk = this.phunk();
      if (!phunk) throw new Error('Phunk not found');

      // Bid value
      const bidValue: number | null = this.bidValue.value;
      if (!bidValue) throw new Error('You must enter a bid value');

      // Get the current active auction
      const currentAuction = await this.web3Svc.getAuctionByPrevOwnerAndHashId({
        prevOwner: phunk.prevOwner!,
        hashId: phunk.hashId
      });

      // Send the tx
      const hash = await this.web3Svc.createBid(bidValue, phunk.hashId, phunk.prevOwner!);
      this.resetBid();

      // Wait for the tx to be mined
      if (!hash) throw new Error('Transaction failed');
      await this.web3Svc.waitForTransaction(hash);

      this.closeError();

    } catch (err: any) {
      // console.log(err);
      this.errorMessage.set(err.error?.message || err.message);
    }
  }

  setInputError(err: any) {
    this.inputError.set(true);
    this.errorMessage.set(err);
  }

  resetBid(): void {
    this.bidValue.reset();
  }

  closeError() {
    this.errorMessage.set(null);
  }

  handleTimeLeft(timeLeft: any): void {
    this.auctionComplete.set(timeLeft.left <= 0);
  }

}
