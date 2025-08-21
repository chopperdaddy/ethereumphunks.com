import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';

import { Store } from '@ngrx/store';
import { map, tap, shareReplay } from 'rxjs';

import { ChatService } from '@/services/chat.service';
// import { PageContextService } from '@/services/page-context.service';

import { GlobalState } from '@/models/global-state';

import { AvatarComponent } from '@/components/avatar/avatar.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { selectActiveConversation } from '@/state/chat/chat.selectors';
import { setActiveConversation, setChat } from '@/state/chat/chat.actions';
import { selectWalletAddress } from '@/state/app/app-state.selectors';
import { NormalizedConversationWithMessages } from '@/models/chat';

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    NgTemplateOutlet,

    ReactiveFormsModule,
    TimeagoModule,

    WalletAddressDirective,
    AvatarComponent
  ],
  templateUrl: './conversation.component.html',
  styleUrl: './conversation.component.scss'
})
export class ConversationComponent {

  @ViewChild('messages') messages!: ElementRef<HTMLDivElement>;

  conversation$ = this.store.select(selectActiveConversation).pipe(
    map((conversation) => {
      if (!conversation) return null;
      return {
        ...conversation,
        messages: conversation?.messages ? [...conversation.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) : []
      }
    }),
    // tap((conversation) => console.log({conversation})),
    tap(() => setTimeout(() => this.scrollToBottom(), 100)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  walletAddress$ = this.store.select(selectWalletAddress);

  error = signal<string | null>(null);
  messageInput: FormControl<string | null> = new FormControl(null);

  constructor(
    private store: Store<GlobalState>,
    public chatSvc: ChatService,
    // private pageContextSvc: PageContextService,
  ) {}

  async sendMessage($event: Event, conversation: NormalizedConversationWithMessages | null) {
    if (!conversation) return;

    $event.preventDefault();
    const message = this.messageInput.value;
    if (!message) return;

    try {
      await this.chatSvc.sendMessageToConversation(conversation.id, message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }

    this.messageInput.setValue(null);
    this.scrollToBottom();
  }

  goBack() {
    this.store.dispatch(setChat({ active: true }));
    this.store.dispatch(setActiveConversation({ conversation: null }));
  }

  scrollToBottom() {
    this.messages.nativeElement.scrollTop = this.messages.nativeElement.scrollHeight;
  }
}
