import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { environment } from 'src/environments/environment';

import { GlobalState, Transaction } from '@/models/global-state';

import * as appStateActions from '@/state/actions/app-state.actions';
import { TimeagoModule } from 'ngx-timeago';

@Component({
  selector: 'app-notif',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,

    PhunkImageComponent,

    WalletAddressDirective
  ],
  templateUrl: './notif.component.html',
  styleUrls: ['./notif.component.scss'],
  host: {
    '(mouseenter)': 'onMouseEnter(txn.id)',
    '(mouseleave)': 'onMouseLeave(txn.id)'
  }
})
export class NotifComponent {

  @Input() txn: Transaction | undefined;
  @Input() dismissible: boolean = true;
  @Input() isMenu: boolean = false;

  env = environment;

  titles: any = {
    sendToEscrow: 'Send to Escrow',
    phunkNoLongerForSale: 'Delist EtherPhunk',
    offerPhunkForSale: 'Offer EtherPhunk For Sale',
    withdrawBidForPhunk: 'Withdraw Bid For EtherPhunk',
    acceptBidForPhunk: 'Accept Bid For EtherPhunk',
    buyPhunk: 'Buy EtherPhunk',
    enterBidForPhunk: 'Enter Bid For EtherPhunk',
    transferPhunk: 'Transfer EtherPhunk',
    withdrawPhunk: 'Withdraw EtherPhunk from Escrow',
    purchased: 'Your EtherPhunk Sold!',
    batch: {
      sendToEscrow: 'Send <span class="highlight">%length%</span> EtherPhunks to Escrow',
      phunkNoLongerForSale: 'Delist <span class="highlight">%length%</span> EtherPhunks',
      offerPhunkForSale: 'Offer <span class="highlight">%length%</span> EtherPhunks For Sale',
      withdrawBidForPhunk: 'Withdraw Bid For <span class="highlight">%length%</span> EtherPhunks',
      acceptBidForPhunk: 'Accept Bid For <span class="highlight">%length%</span> EtherPhunks',
      buyPhunk: 'Buy <span class="highlight">%length%</span> EtherPhunks',
      enterBidForPhunk: 'Enter Bid For <span class="highlight">%length%</span> EtherPhunks',
      transferPhunk: 'Transfer <span class="highlight">%length%</span> EtherPhunks',
      withdrawPhunk: 'Withdraw <span class="highlight">%length%</span> EtherPhunks from Escrow',
    }
  };

  classes: any = {
    sendToEscrow: 'escrow',
    phunkNoLongerForSale: 'sale',
    offerPhunkForSale: 'sale',
    withdrawBidForPhunk: 'bid',
    acceptBidForPhunk: 'bid',
    buyPhunk: 'sale',
    enterBidForPhunk: 'bid',
    transferPhunk: 'transfer',
    withdrawPhunk: 'escrow',
    purchased: 'purchased'
  };

  transactionTypes: any = {
    event: {
      message: 'EtherPhunk #%phunkId%'
    },
    wallet: {
      message: '<strong>Please submit</strong> the transaction using your connected Ethereum wallet.'
    },
    pending: {
      title: {},
      message: 'Your transaction is <strong>being processed</strong> on the Ethereum network.'
    },
    complete: {
      title: {},
      message: 'Your transaction is <strong>complete</strong>.'
    },
    error: {
      title: {},
      message: 'There was an <strong>error</strong> with your transaction.'
    }
  };

  constructor(
    private store: Store<GlobalState>
  ) {}

  dismiss(txn: Transaction) {
    this.store.dispatch(appStateActions.removeTransaction({ txId: txn.id }));
  }

  onMouseEnter(notificationId: string) {
    if (this.isMenu) return;
    this.store.dispatch(appStateActions.setNotifHoverState({ notifHoverState: { [notificationId]: true } }));
  }

  onMouseLeave(notificationId: string) {
    if (this.isMenu) return;
    this.store.dispatch(appStateActions.setNotifHoverState({ notifHoverState: { [notificationId]: false } }));
  }

}
