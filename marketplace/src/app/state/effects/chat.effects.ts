import { Injectable } from '@angular/core';
import { setChatActive, setChatConnected, setToUser } from '../actions/chat.actions';

import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';

import { GlobalState, Notification } from '@/models/global-state';
import { Event } from '@/models/db';

import { EMPTY, catchError, concatMap, delay, filter, from, map, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DataService } from '@/services/data.service';

import { selectNotifHoverState, selectNotifications } from '../selectors/notification.selectors';
import { selectCurrentBlock, selectWalletAddress } from '../selectors/app-state.selectors';

import { setCurrentBlock, setWalletAddress } from '../actions/app-state.actions';
import { removeNotification, setNotifications, upsertNotification } from '../actions/notification.actions';
import { UtilService } from '@/services/util.service';
import { ChatService } from '@/services/chat.service';


@Injectable()
export class ChatEffects {

  chatActive$ = createEffect(() => this.actions$.pipe(
    ofType(setChatActive),
    // filter((action) => action.active),
    withLatestFrom(this.store.select(selectWalletAddress)),
    filter(([_, address]) => !!address),
    switchMap(([action, address]) => {
      return from(this.chatSvc.reconnectXmtp(address!)).pipe(
        tap((connected) => console.log({ connected })),
        map((connected) => setChatConnected({ connected })),
      );
    }),
  ));

  onToUser$ = createEffect(() => this.actions$.pipe(
    ofType(setToUser),
    tap((action) => console.log({ action })),
  ), { dispatch: false });

  // addressChanged$ = createEffect(() => this.actions$.pipe(
  //   ofType(setWalletAddress),
  //   map((action) => {
  //     const stored = localStorage.getItem(`EtherPhunks_notifs__${environment.chainId}__${action.walletAddress}`);
  //     const notifications = JSON.parse(stored || '[]')
  //     return setNotifications({ notifications });
  //   })
  // ));

  // onNotificationEvent$ = createEffect(() => this.actions$.pipe(
  //   ofType(upsertNotification, removeNotification),
  //   withLatestFrom(
  //     this.store.select(selectNotifications),
  //     this.store.select(selectWalletAddress),
  //   ),
  //   tap(([_, notifications, address]) => {
  //     localStorage.setItem(
  //       `EtherPhunks_notifs__${environment.chainId}__${address}`,
  //       JSON.stringify(notifications.filter((txn: Notification) => txn.type === 'complete' || txn.type === 'event'))
  //     );
  //   }),
  //   concatMap(([action]) =>
  //     action.type === '[App State] Upsert Notification'
  //     && (
  //       action.notification.type === 'complete'
  //       || action.notification.type === 'error'
  //     ) ?
  //     of(action).pipe(
  //       delay(5000),
  //       withLatestFrom(this.store.select(selectNotifHoverState)),
  //       tap(([action, notifHoverState]) => {
  //         if (!notifHoverState[action.notification.id]) {
  //           this.store.dispatch(removeNotification({ txId: action.notification.id }));
  //         }
  //       })
  //     ) :
  //     EMPTY
  //   )
  // ), { dispatch: false });

  // onBlockNumber$ = createEffect(() => this.actions$.pipe(
  //   ofType(setCurrentBlock),
  //   withLatestFrom(this.store.select(selectWalletAddress)),
  //   switchMap(([action, address]) => {
  //     const currentBlock = action.currentBlock;
  //     const storedBlock = localStorage.getItem('EtherPhunks_currentBlock');
  //     if (address && storedBlock && (currentBlock - Number(storedBlock)) > 2) {
  //       return this.dataSvc.fetchMissedEvents(address, Number(storedBlock)).pipe(
  //         tap((events) => {
  //           for (const event of events) this.checkEventForPurchaseFromUser(event, address);
  //         }),
  //         catchError((err) => of([])),
  //       );
  //     }
  //     return of([]);
  //   }),
  //   withLatestFrom(this.store.select(selectCurrentBlock)),
  //   tap(([_, blockNumber]) => localStorage.setItem('EtherPhunks_currentBlock', JSON.stringify(blockNumber))),
  // ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService,
    private web3Svc: Web3Service,
    private utilSvc: UtilService,
    private chatSvc: ChatService,
  ) {}

  // checkEventForPurchaseFromUser(event: Event, userAddress: string) {
  //   if (!userAddress) return;
  //   if (event.type === 'PhunkBought' && event.from.toLowerCase() === userAddress?.toLowerCase()) {
  //     // This phunk was bought FROM the active user.
  //     // We can notify them of this purchase
  //     this.store.dispatch(upsertNotification({
  //       notification: {
  //         id: this.utilSvc.createIdFromString('purchased' + event.hashId + event.txHash),
  //         timestamp: Date.now(),
  //         type: 'event',
  //         function: 'purchased',
  //         hashId: event.hashId!,
  //         tokenId: event.tokenId,
  //         hash: event.txHash,
  //         isNotification: true,
  //         detail: event,
  //         value: Number(this.web3Svc.weiToEth(event.value)),
  //       }
  //     }));
  //   }
  // }
}
