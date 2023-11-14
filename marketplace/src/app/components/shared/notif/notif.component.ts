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
  styleUrls: ['./notif.component.scss']
})
export class NotifComponent {

  @Input() txn: Transaction | undefined;
  @Input() dismissible: boolean = true;

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
    purchased: 'Your EtherPhunk Sold!'
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

}
