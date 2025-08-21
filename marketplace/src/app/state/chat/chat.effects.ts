import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState, Notification, UnreadConversations } from '@/models/global-state';

import { from, map, switchMap, distinctUntilChanged, filter, withLatestFrom, of, catchError, tap, combineLatest, mergeMap } from 'rxjs';

import { ChatService } from '@/services/chat.service';
import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { StorageService } from '@/services/storage.service';
import { UtilService } from '@/services/util.service';

import { setWalletAddress } from '@/state/app/app-state.actions';
import { selectWalletAddress } from '@/state/app/app-state.selectors';

import { setChatConnected, setHasAccount, setConversations, setChat, setActiveConversation, setCreateConversationWithAddress, setUnreadConversations, clearUnreadForConversation } from './chat.actions';
import { selectActiveConversation, selectConversations, selectUnreadConversations } from './chat.selectors';

import { upsertNotification } from '@/state/notification/notification.actions';

@Injectable()
export class ChatEffects {

  hasAccount$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    distinctUntilChanged((prev, curr) => prev.walletAddress === curr.walletAddress),
    switchMap(({ walletAddress }) => {
      return from(this.chatSvc.hasStoredUserSalt(walletAddress as `0x${string}`));
    }),
    map((hasAccount) => setHasAccount({ hasAccount })),
  ));

  loginAccount$ = createEffect(() => this.actions$.pipe(
    ofType(setHasAccount),
    filter(({ hasAccount }) => !!hasAccount),
    switchMap(({ hasAccount }) => {
      return this.store.select(selectWalletAddress).pipe(
        switchMap((walletAddress) => {
          return from(this.chatSvc.connectExistingXmtpUser('', walletAddress as `0x${string}`));
        }),
        map(({ connected, activeInboxId }) => setChatConnected({ connected, activeInboxId }))
      )
    }),
  ));

  conversations$ = createEffect(() => this.actions$.pipe(
    ofType(setChatConnected),
    withLatestFrom(this.store.select(selectWalletAddress)),
    filter(([{ connected }, walletAddress]) => connected && !!walletAddress),
    switchMap(([_, walletAddress]) => this.chatSvc.listAndStreamAllDms(walletAddress?.toLowerCase() as `0x${string}`).pipe(
      switchMap((convos) => {
        // Get the other person's address (not the logged-in user)
        const otherAddresses = convos.map(convo => {
          return convo.members?.find(member =>
            member?.identifier?.toLowerCase() !== walletAddress?.toLowerCase()
          )?.identifier?.toLowerCase();
        }).filter((address): address is string => !!address);

        return this.dataSvc.addressesAreHolders(otherAddresses).pipe(
          map((allowed) => {
            // console.log({allowed, otherAddresses});
            const allowedAddresses = allowed?.map((res: any) => res?.address) || [];
            return convos.filter((convo) => {
              const otherPersonAddress = convo.members?.find(member =>
                member?.identifier?.toLowerCase() !== walletAddress?.toLowerCase()
              )?.identifier?.toLowerCase();
              return allowedAddresses.includes(otherPersonAddress);
            });
          })
        );
      }),
      map((conversations) => setConversations({ conversations })),
    )),
  ));

  unreadConversations$ = createEffect(() => this.actions$.pipe(
    ofType(setChatConnected),
    withLatestFrom(this.store.select(selectWalletAddress)),
    filter(([{ connected }, walletAddress]) => connected && !!walletAddress),
    switchMap(([_, walletAddress]) => {
      return this.chatSvc.streamAllMessages(walletAddress as `0x${string}`).pipe(
        withLatestFrom(
          this.store.select(selectConversations),
          this.store.select(selectActiveConversation),
          this.store.select(selectUnreadConversations)
        ),
        switchMap(([message, conversations, activeConversation, unreadConversations]) => {
          // If message is for active conversation, clear its unread count
          if (message.conversationId === activeConversation?.id) {
            return of([
              clearUnreadForConversation({ conversationId: message.conversationId })
            ]);
          }

          if (walletAddress === message.senderAddress) return of([]);

          // Skip if no sender address
          if (!message.senderAddress) return of([]);

          // Check if sender is a holder before processing notification
          return this.dataSvc.addressesAreHolders([message.senderAddress]).pipe(
            map((allowed) => {
              const allowedAddresses = allowed?.map((res: any) => res?.address) || [];
              const isHolderAllowed = allowedAddresses.includes(message.senderAddress?.toLowerCase());

              if (!isHolderAllowed) {
                return []; // Don't process messages from non-holders
              }

              const notification = {
                id: this.utilSvc.createIdFromString(message.conversationId),
                timestamp: Date.now(),
                type: 'chat',
                function: 'chatMessage',
                chatAddress: message.senderAddress,
                conversationId: message.conversationId,
              } as Notification;

              // Message is for inactive conversation - increment unread count
              const existingUnreadCount = unreadConversations?.[message.conversationId];
              if (existingUnreadCount !== undefined) {
                return [
                  upsertNotification({ notification }),
                  setUnreadConversations({
                    unreadConversations: {
                      ...(unreadConversations || {}),
                      [message.conversationId]: existingUnreadCount + 1
                    }
                  })
                ];
              }

              return [
                upsertNotification({ notification }),
                setUnreadConversations({
                  unreadConversations: {
                    ...(unreadConversations || {}),
                    [message.conversationId]: 1
                  }
                })
              ];
            })
          );
        }),
        mergeMap(actions => actions)
      )
    }),
  ));

  createConversationWithAddress$ = createEffect(() => this.actions$.pipe(
    ofType(setCreateConversationWithAddress),
    filter(({ address }) => !!address),
    switchMap(({ address }) => from(this.chatSvc.checkIfUserIsOnNetwork(address!)).pipe(
      switchMap((isOnNetwork) => {
        console.log({isOnNetwork});
        return from(this.chatSvc.createConversation(address!));
      }),
      catchError((error) => {
        console.log('Error creating conversation', error);
        return of(null);
      })
    )),
    map((conversationId) => setChat({ active: true, activeConversationId: conversationId })),
  ));

  activeConversation$ = createEffect(() => this.actions$.pipe(
    ofType(setChat),
    switchMap(({ activeConversationId }) => {
      if (!activeConversationId) return of(null);
      return this.chatSvc.getAndStreamConversationMessages(activeConversationId);
    }),
    map((conversation) => setActiveConversation({ conversation })),
  ));

  clearUnreadOnActivate$ = createEffect(() => this.actions$.pipe(
    ofType(setActiveConversation),
    filter(({ conversation }) => !!conversation?.id),
    map(({ conversation }) => clearUnreadForConversation({ conversationId: conversation!.id }))
  ));

  loadUnreadConversations$ = createEffect(() => this.actions$.pipe(
    ofType(setChatConnected),
    withLatestFrom(this.store.select(selectWalletAddress)),
    filter(([{ connected }, walletAddress]) => connected && !!walletAddress),
    switchMap(([_, walletAddress]) =>
      from(this.storageSvc.getItem<UnreadConversations>(this.getUnreadStorageKey(walletAddress!), true)).pipe(
        map((storedUnreadConversations) =>
          setUnreadConversations({ unreadConversations: storedUnreadConversations || {} })
        )
      )
    )
  ));

  persistUnreadConversations$ = createEffect(() => this.actions$.pipe(
    ofType(setUnreadConversations, clearUnreadForConversation),
    withLatestFrom(
      this.store.select(selectWalletAddress),
      this.store.select(selectUnreadConversations)
    ),
    filter(([_, walletAddress, __]) => !!walletAddress),
    tap(([action, walletAddress, currentUnreadConversations]) => {
      this.storageSvc.setItem(this.getUnreadStorageKey(walletAddress!), currentUnreadConversations || {}, true);
    })
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private chatSvc: ChatService,
    private dataSvc: DataService,
    private web3Svc: Web3Service,
    private storageSvc: StorageService,
    private utilSvc: UtilService,
  ) {}

  private getUnreadStorageKey(walletAddress: string): string {
    return `chat-unread-conversations-${walletAddress.toLowerCase()}`;
  }
}
