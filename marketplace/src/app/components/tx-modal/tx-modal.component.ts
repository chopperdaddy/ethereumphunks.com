import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { GlobalState, Transaction } from '@/models/global-state';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as selectors from '@/state/selectors/app-state.selector';

import { environment } from 'src/environments/environment';

import { map } from 'rxjs';

export type TxFunction = 'sendToEscrow' | 'phunkNoLongerForSale' | 'offerPhunkForSale' | 'withdrawBidForPhunk' | 'acceptBidForPhunk' | 'buyPhunk' | 'enterBidForPhunk' | 'transferPhunk' | 'withdrawPhunk';

@Component({
  selector: 'app-tx-modal',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    PhunkImageComponent,
    WalletAddressDirective
  ],
  templateUrl: './tx-modal.component.html',
  styleUrls: ['./tx-modal.component.scss']
})
export class TxModalComponent {

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
    withdrawPhunk: 'Withdraw EtherPhunk from Escrow'
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
    withdrawPhunk: 'escrow'
  };

  transactionTypes: any = {
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

  transactions$ = this.store.select(selectors.selectTransactions).pipe(
    map((txns: Transaction[]) => {
      return [...txns].sort((a, b) => b.id - a.id)
    })
  );

  constructor(
    private store: Store<GlobalState>
  ) {}
}
