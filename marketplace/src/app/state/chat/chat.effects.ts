import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState } from '@/models/global-state';

import { from, map, switchMap, distinctUntilChanged, filter, withLatestFrom, of, catchError } from 'rxjs';

import { ChatService } from '@/services/chat.service';
import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';

import { setWalletAddress } from '@/state/app/app-state.actions';
import { selectWalletAddress } from '@/state/app/app-state.selectors';

import { setChatConnected, setHasAccount, setConversations, setChatActive, setActiveConversation, setCreateConversationWithAddress } from './chat.actions';

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
    switchMap(([_, walletAddress]) => this.chatSvc.listAndStreamAllDms(walletAddress?.toLowerCase() as `0x${string}`)),
    switchMap((convos) => {
      const addresses = convos.map(convo => convo.members[0]?.identifier?.toLowerCase());
      return this.dataSvc.addressesAreHolders(addresses).pipe(
        map((allowed) => {
          const allowedAddresses = allowed?.map((res: any) => res?.address) || [];
          return convos.filter((convo) => {
            return allowedAddresses.includes(convo?.members[0]?.identifier?.toLowerCase());
          });
        })
      );
    }),
    map((conversations) => setConversations({ conversations })),
  ));

  activeConversation$ = createEffect(() => this.actions$.pipe(
    ofType(setChatActive),
    filter(({ activeConversationId }) => !!activeConversationId),
    switchMap(({ activeConversationId }) => {
      return this.chatSvc.getAndStreamConversationMessages(activeConversationId!);
    }),
    filter((conversation) => !!conversation),
    map((conversation) => setActiveConversation({ conversation })),
  ));

  createConversationWithAddress$ = createEffect(() => this.actions$.pipe(
    ofType(setCreateConversationWithAddress),
    filter(({ address }) => !!address),
    switchMap(({ address }) => from(this.chatSvc.createConversation(address!)).pipe(
      catchError((error) => {
        console.error('Error creating conversation', error);
        return of(null);
      })
    )),
    map((conversationId) => setChatActive({ active: true, activeConversationId: conversationId })),
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private chatSvc: ChatService,
    private dataSvc: DataService,
    private web3Svc: Web3Service,
  ) {}
}
