import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, delay, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { zeroAddress } from 'viem';

import { Collection } from '@/models/data.state';
import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { UtilService } from '@/services/util.service';

import { TimerComponent } from '@/components/auction/timer/timer.component';
import { BidHistoryComponent } from '@/components/auction/bid-history/bid-history.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { upsertNotification } from '@/state/notification/notification.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,

    TimerComponent,
    BidHistoryComponent,

    WalletAddressDirective,

    WeiToEthPipe
  ],
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.scss']
})

export class AuctionComponent {

  zeroAddr = zeroAddress;

  phunk = input.required<Phunk>();
  phunk$ = toObservable(this.phunk);

  collection = input<Collection | undefined>();
  collection$ = toObservable(this.collection);

  phunkWithAuction$ = combineLatest([this.phunk$, this.collection$]).pipe(
    // delay(5000),
    filter(([phunk, collection]) => !!phunk?.auction || !!phunk?.isAuctioned),
    map(([phunk, collection]) => {
      const hasCollection = !!phunk.collection;
      if (hasCollection) return phunk;
      return { ...phunk, collection };
    }),
    switchMap((phunk) => this.web3Svc.watchAuctionByPrevOwnerAndHashId({
      prevOwner: phunk!.prevOwner!,
      hashId: phunk!.hashId
    }).pipe(
      map((auction): Phunk | null => ({ ...phunk, auction })),
    )),
  );

  auctionBids$ = this.phunkWithAuction$.pipe(
    distinctUntilChanged((a, b) => a?.auction?.auctionId === b?.auction?.auctionId),
    switchMap((phunkWithAuction) => {
      if (!phunkWithAuction?.auction) return of([]);
      return this.dataSvc.watchAuctionBids(phunkWithAuction.auction.auctionId);
    }),
  );

  bidValue = new FormControl<number | null>(null);

  auctionComplete = signal(false);
  inputError = signal(false);

  constructor(
    private store: Store<GlobalState>,
    public web3Svc: Web3Service,
    public dataSvc: DataService,
    public utilSvc: UtilService,
  ) {}

  async submitBid(): Promise<void> {

    // Get the phunk
    const phunk = this.phunk();
    if (!phunk) throw new Error('Phunk not found');

    // Get the bid value
    const bidValue: number | null = this.bidValue.value;
    if (!bidValue) throw new Error('You must enter a bid value');

    // Create the notification
    let notification: Notification = {
      id: this.utilSvc.createIdFromString('createBid' + phunk.hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'createBid',
      hashId: phunk.hashId,
      tokenId: phunk.tokenId,
      value: bidValue,
    };

    // Dispatch the notification
    this.store.dispatch(upsertNotification({ notification }));

    try {
      // Get the current active auction
      // const currentAuction = await this.web3Svc.getAuctionByPrevOwnerAndHashId({
      //   prevOwner: phunk.prevOwner!,
      //   hashId: phunk.hashId
      // });

      // Send the tx
      const hash = await this.web3Svc.createBid(bidValue, phunk.hashId, phunk.prevOwner!);
      if (!hash) throw new Error('Transaction failed');

      // Reset the bid value
      this.resetBid();

      // Update the notification
      notification = {
        ...notification,
        type: 'pending',
        hash,
      };

      // Dispatch the notification
      this.store.dispatch(upsertNotification({ notification }));

      // Poll the receipt
      const receipt = await this.web3Svc.pollReceipt(hash!);

      // Update the notification
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

    } catch (err) {
      console.log(err);

      // Update the notification
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      // Dispatch the notification
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async settleAuction(): Promise<void> {
    const phunk = this.phunk();
    if (!phunk) throw new Error('Phunk not found');

    // Create the notification
    let notification: Notification = {
      id: this.utilSvc.createIdFromString('settleAuction' + phunk.hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'settleAuction',
      hashId: phunk.hashId,
      tokenId: phunk.tokenId,
    };

    // Dispatch the notification
    this.store.dispatch(upsertNotification({ notification }));

    try {
      // Get the current active auction
      // const currentAuction = await this.web3Svc.getAuctionByPrevOwnerAndHashId({
      //   prevOwner: phunk.prevOwner!,
      //   hashId: phunk.hashId
      // });

      // Send the tx
      const hash = await this.web3Svc.settleAuction(phunk.hashId, phunk.prevOwner!);
      if (!hash) throw new Error('Transaction failed');

      // Reset the bid value
      this.resetBid();

      // Update the notification
      notification = {
        ...notification,
        type: 'pending',
        hash,
      };

      // Dispatch the notification
      this.store.dispatch(upsertNotification({ notification }));

      // Poll the receipt
      const receipt = await this.web3Svc.pollReceipt(hash!);

      // Update the notification
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

    } catch (err) {
      console.log(err);

      // Update the notification
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      // Dispatch the notification
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  resetBid(): void {
    this.bidValue.reset();
  }

  handleTimeLeft(timeLeft: any): void {
    this.auctionComplete.set(timeLeft.left <= 0);
  }
}
