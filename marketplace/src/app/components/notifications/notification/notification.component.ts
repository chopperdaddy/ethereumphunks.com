import { Component, Input, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';

import { NotificationImageComponent } from '@/components/notifications/notification-image/notification-image.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { NotificationPipe } from './notification.pipe';

import { environment } from '@environments/environment';

import { GlobalState, Notification } from '@/models/global-state';

import { map } from 'rxjs';

import * as dataStateSelectors from '@/state/data/data-state.selectors';

import { removeNotification, setNotifHoverState } from '@/state/notification/notification.actions';
import { setChat } from '@/state/chat/chat.actions';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,

    NotificationImageComponent,

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

  staticUrl = environment.staticUrl;

  txn = input<Notification | undefined>();
  dismissible = input<boolean>(true);
  isMenu = input<boolean>(false);

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
  ) {
    effect(() => {
      if (this.txn()?.type === 'error') {
        // console.log('NotificationComponent', {...this.txn()?.detail});
      }
    });
  }

  dismiss(txn: Notification) {
    this.store.dispatch(removeNotification({ txId: txn.id }));
  }

  onMouseEnter(notificationId: string) {
    if (this.isMenu()) return;
    this.store.dispatch(setNotifHoverState({ notifHoverState: { [notificationId]: true } }));
  }

  onMouseLeave(notificationId: string) {
    if (this.isMenu()) return;
    this.store.dispatch(setNotifHoverState({ notifHoverState: { [notificationId]: false } }));
  }

  setChat(activeConversationId: string) {
    this.store.dispatch(setChat({ active: true, activeConversationId }));
    this.store.dispatch(removeNotification({ txId: this.txn()?.id || '' }));
  }
}
