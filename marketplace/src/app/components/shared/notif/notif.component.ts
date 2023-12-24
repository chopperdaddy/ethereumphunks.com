import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';

import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { NotifPipe } from './notif.pipe';

import { environment } from 'src/environments/environment';

import { GlobalState, Notification } from '@/models/global-state';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { map, tap } from 'rxjs';


@Component({
  selector: 'app-notif',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,

    PhunkImageComponent,

    WalletAddressDirective,

    NotifPipe
  ],
  templateUrl: './notif.component.html',
  styleUrls: ['./notif.component.scss'],
  host: {
    '(mouseenter)': 'onMouseEnter(txn.id)',
    '(mouseleave)': 'onMouseLeave(txn.id)'
  }
})
export class NotifComponent {

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
    this.store.dispatch(appStateActions.removeNotification({ txId: txn.id }));
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
