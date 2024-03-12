import { Injectable } from '@angular/core';
import { setChatActive, setChatConnected, setToUser } from '../actions/chat.actions';

import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState } from '@/models/global-state';

import { filter, from, map, switchMap, tap, withLatestFrom } from 'rxjs';

import { selectWalletAddress } from '../selectors/app-state.selectors';

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
        // tap((connected) => console.log({ connected })),
        map((connected) => setChatConnected({ connected })),
      );
    }),
  ));

  onToUser$ = createEffect(() => this.actions$.pipe(
    ofType(setToUser),
    // tap((action) => console.log({ action })),
  ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private chatSvc: ChatService,
  ) {}
}
