import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { GlobalState, Notification } from '@/models/global-state';

import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { NotificationComponent } from './notif/notification.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as notificationSelectors from '@/state/selectors/notification.selectors';

import { map } from 'rxjs';

export type TxFunction = 'sendToEscrow' | 'phunkNoLongerForSale' | 'offerPhunkForSale' | 'withdrawBidForPhunk' | 'acceptBidForPhunk' | 'buyPhunk' | 'enterBidForPhunk' | 'transferPhunk' | 'withdrawPhunk';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    PhunkImageComponent,
    NotificationComponent,
    WalletAddressDirective
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent {

  transactions$ = this.store.select(notificationSelectors.selectNotifications).pipe(
    map((txns: Notification[]) => [...txns].sort((a, b) => b.timestamp - a.timestamp))
  );

  constructor(
    private store: Store<GlobalState>
  ) {}

  trackByFn(index: number, item: Notification) {
    return item.id;
  }
}
