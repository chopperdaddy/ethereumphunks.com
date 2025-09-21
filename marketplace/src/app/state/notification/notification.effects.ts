import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';

import { EMPTY, catchError, delay, filter, from, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { Web3Service } from '@/services/web3.service';
import { UtilService } from '@/services/util.service';
import { StorageService } from '@/services/storage.service';
import { DataService } from '@/services/data.service';

import { GlobalState, Notification } from '@/models/global-state';
import { Event } from '@/models/db';

import { selectNotifHoverState, selectNotifications } from '../notification/notification.selectors';
import { selectCurrentBlock, selectWalletAddress } from '../app/app-state.selectors';

import { setCurrentBlock, setWalletAddress } from '../app/app-state.actions';
import { removeNotification, setNotifications, upsertNotification } from '../notification/notification.actions';

import { environment } from '@environments/environment';


@Injectable()
export class NotificationEffects {

  migrateNotifications$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    switchMap((action) => {
      const address = action.walletAddress?.toLowerCase();
      const key = `EtherPhunks_notifs__${environment.chainId}__${address}`;
      const migratedKey = `EtherPhunks_notifs__${environment.chainId}__${address}:migrated`;

      const isMigrated = localStorage.getItem(migratedKey);
      // console.log({isMigrated: !!isMigrated});
      if (isMigrated) return from(this.storageSvc.getItem(key, true)).pipe(map(res => res || []));

      const stored = localStorage.getItem(key);
      if (!stored) return of([]);

      const notifications = JSON.parse(stored);
      // console.log({notifications});
      if (!notifications) return of([]);

      return from(this.storageSvc.setItem(key, notifications, true)).pipe(
        tap(() => {
          localStorage.removeItem(key);
          localStorage.setItem(migratedKey, '1');
        }),
        map(() => notifications)
      );
    }),
    map((notifications) => setNotifications({ notifications })),
  ));

  onRemoveNotification$ = createEffect(() => this.actions$.pipe(
    ofType(removeNotification),
    withLatestFrom(
      this.store.select(selectNotifications),
      this.store.select(selectWalletAddress),
    ),
    switchMap(([_, notifications, address]) => {
      const key = `EtherPhunks_notifs__${environment.chainId}__${address}`;
      return from(this.storageSvc.setItem(
        key,
        notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'),
        true
      ));
    }),
  ), { dispatch: false });

  onNotificationEvent$ = createEffect(() => this.actions$.pipe(
    ofType(upsertNotification),
    withLatestFrom(
      this.store.select(selectNotifications),
      this.store.select(selectWalletAddress),
    ),
    switchMap(([action, notifications, address]) => {
      const key = `EtherPhunks_notifs__${environment.chainId}__${address}`;
      return from(this.storageSvc.setItem(
        key,
        notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'),
        true
      )).pipe(
        switchMap(() => {
          // If the notification is a complete or error, remove it after 5 seconds
          if (action.notification.type === 'complete' || action.notification.type === 'error') {
            return of(action).pipe(
              delay(5000),
              withLatestFrom(this.store.select(selectNotifHoverState)),
              tap(([action, notifHoverState]) => {
                if (!notifHoverState[action.notification.id]) {
                  this.store.dispatch(removeNotification({ txId: action.notification.id }));
                }
              })
            );
          }
          return EMPTY;
        })
      );
    }),
  ), { dispatch: false });

  onBlockNumber$ = createEffect(() => this.actions$.pipe(
    ofType(setCurrentBlock),
    withLatestFrom(this.store.select(selectWalletAddress)),
    switchMap(([action, address]) => {
      const currentBlock = action.currentBlock;
      const storedBlock = localStorage.getItem(`EtherPhunks_currentBlock_${environment.chainId}`);
      // console.log({currentBlock, storedBlock}, currentBlock - Number(storedBlock));
      if (address && storedBlock && (currentBlock - Number(storedBlock)) > 0) {
        return this.dataSvc.fetchMissedEvents(address, Number(storedBlock)).pipe(
          tap((events) => {
            // console.log('missed events', events);
            for (const event of events) this.checkEventForPurchaseFromUser(event, address);
          }),
          catchError((err) => of([])),
        );
      }
      return of([]);
    }),
    withLatestFrom(this.store.select(selectCurrentBlock)),
    tap(([_, blockNumber]) => localStorage.setItem(`EtherPhunks_currentBlock_${environment.chainId}`, JSON.stringify(blockNumber))),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService,
    private web3Svc: Web3Service,
    private utilSvc: UtilService,
    private storageSvc: StorageService
  ) {}

  checkEventForPurchaseFromUser(event: Event, userAddress: string) {
    if (!userAddress) return;
    if (event.type === 'PhunkBought' && event.from.toLowerCase() === userAddress?.toLowerCase()) {
      // This phunk was bought FROM the active user.
      // We can notify them of this purchase
      this.store.dispatch(upsertNotification({
        notification: {
          id: this.utilSvc.createIdFromString('purchased' + event.hashId + event.txHash),
          timestamp: Date.now(),
          type: 'event',
          function: 'purchased',
          hashId: event.hashId!,
          tokenId: event.tokenId,
          hash: event.txHash,
          isNotification: true,
          detail: event,
          value: Number(this.web3Svc.weiToEth(event.value)),
        }
      }));
    }
  }
}
