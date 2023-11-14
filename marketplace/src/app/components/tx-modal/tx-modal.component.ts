import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { GlobalState, Transaction } from '@/models/global-state';

import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { NotifComponent } from '../shared/notif/notif.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { map } from 'rxjs';

export type TxFunction = 'sendToEscrow' | 'phunkNoLongerForSale' | 'offerPhunkForSale' | 'withdrawBidForPhunk' | 'acceptBidForPhunk' | 'buyPhunk' | 'enterBidForPhunk' | 'transferPhunk' | 'withdrawPhunk';

@Component({
  selector: 'app-tx-modal',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    PhunkImageComponent,
    NotifComponent,
    WalletAddressDirective
  ],
  templateUrl: './tx-modal.component.html',
  styleUrls: ['./tx-modal.component.scss']
})
export class TxModalComponent {

  transactions$ = this.store.select(appStateSelectors.selectTransactions).pipe(
    map((txns: Transaction[]) => [...txns].sort((a, b) => b.id - a.id))
  );

  constructor(
    private store: Store<GlobalState>
  ) {}

  trackByFn(index: number, item: Transaction) {
    return item.id;
  }
}
