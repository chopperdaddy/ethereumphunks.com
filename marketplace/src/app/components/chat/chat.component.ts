import { Component, Input } from '@angular/core';

import { ConversationComponent } from './conversation/conversation.component';
import { ConversationsComponent } from './conversations/conversations.component';
import { LoginComponent } from './login/login.component';

import { selectChatActive, selectChatConnected, selectToUser } from '@/state/selectors/chat.selectors';
import { GlobalState } from '@/models/global-state';
import { Store } from '@ngrx/store';

import { Observable, map, switchMap, withLatestFrom } from 'rxjs';
import { AsyncPipe } from '@angular/common';

// import anime from 'animejs';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,

    LoginComponent,
    ConversationsComponent,
    ConversationComponent,
  ],
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {

  activeView$: Observable<'conversations' | 'conversation' | 'login'> = this.store.select(selectToUser).pipe(
    switchMap((user) => {
      return this.store.select(selectChatConnected).pipe(
        map((chatConnected) => {
          // console.log({ user, chatConnected });
          if (chatConnected) return user ? 'conversation' : 'conversations';
          return 'login';
        })
      )
    }),
  );

  constructor(
    private store: Store<GlobalState>,
  ) {}

  // setView() {
  //   anime.timeline({
  //     easing: 'cubicBezier(0.785, 0.135, 0.15, 0.86)',
  //     duration: 400,
  //   }).add({
  //     targets: this.el?.nativeElement,
  //     translateX: this.active ? '0' : '100%',
  //   });
  // }
}
