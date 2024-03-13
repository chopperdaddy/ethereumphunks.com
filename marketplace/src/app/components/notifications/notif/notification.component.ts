import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';

import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { NotificationPipe } from './notification.pipe';

import { environment } from 'src/environments/environment';

import { GlobalState, Notification } from '@/models/global-state';

import { map } from 'rxjs';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { removeNotification, setNotifHoverState } from '@/state/actions/notification.actions';
import { setChatActive, setToUser } from '@/state/actions/chat.actions';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,

    PhunkImageComponent,

    WalletAddressDirective,

    NotificationPipe
  ],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  host: {
    '(mouseenter)': 'onMouseEnter(txn.id)',
    '(mouseleave)': 'onMouseLeave(txn.id)'
  }
})
export class NotificationComponent {

  @Input() txn: Notification | undefined;
  @Input() dismissible: boolean = true;
  @Input() isMenu: boolean = false;

  env = environment;

  collections$ = this.store.select(dataStateSelectors.selectCollections).pipe(
    map((res) => {
      const obj: any = {};
      res?.forEach((coll: any) => obj[coll.slug] = coll);
      return Object.keys(obj).length ? obj : null;
    }),
    // tap(collections => console.log('collections', collections)),
  );

  constructor(
    private store: Store<GlobalState>
  ) {}

  dismiss(txn: Notification) {
    this.store.dispatch(removeNotification({ txId: txn.id }));
  }

  onMouseEnter(notificationId: string) {
    if (this.isMenu) return;
    this.store.dispatch(setNotifHoverState({ notifHoverState: { [notificationId]: true } }));
  }

  onMouseLeave(notificationId: string) {
    if (this.isMenu) return;
    this.store.dispatch(setNotifHoverState({ notifHoverState: { [notificationId]: false } }));
  }

  setChatActive(address: string) {
    this.store.dispatch(setChatActive({ active: true }));
    this.store.dispatch(setToUser({ address }));
    this.store.dispatch(removeNotification({ txId: this.txn?.id || '' }));
  }

}
