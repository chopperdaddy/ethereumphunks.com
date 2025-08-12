import { Component, signal } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';

import { Store } from '@ngrx/store';
import { Observable, map, switchMap } from 'rxjs';

import { ConversationComponent } from './conversation/conversation.component';
import { ConversationsComponent } from './conversations/conversations.component';
import { LoginComponent } from './login/login.component';

import { selectChat, selectChatConnected, selectChatState } from '@/state/chat/chat.selectors';
import { selectConfig } from '@/state/app/app-state.selectors';

import { ViewType } from '@/models/chat';
import { GlobalState } from '@/models/global-state';
import { setChat } from '@/state/chat/chat.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule,
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

  activeViewTitle = signal<string | null>(null);

  activeView$: Observable<ViewType> = this.store.select(selectChat).pipe(
    switchMap(({ active, activeConversationId }) => {
      return this.store.select(selectChatConnected).pipe(
        map(({ connected, activeInboxId }) => {
          if (connected) return activeConversationId ? 'conversation' : 'conversations';
          return 'login';
        })
      )
    }),
  );

  constructor(
    private store: Store<GlobalState>,
  ) {}

  setChatTitle(title: string | null) {
    this.activeViewTitle.set(title);
  }

  closeChat() {
    this.store.dispatch(setChat({ active: false }));
  }
}
