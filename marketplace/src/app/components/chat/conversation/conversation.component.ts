import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';

import { Store } from '@ngrx/store';
import { map, tap, filter, switchMap, share, shareReplay } from 'rxjs';

import { ChatService } from '@/services/chat.service';

import { GlobalState } from '@/models/global-state';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { MarkdownPipe } from '@/pipes/markdown.pipe';

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
    MarkdownPipe
  ],
  templateUrl: './conversation.component.html',
  styleUrl: './conversation.component.scss'
})
export class ConversationComponent {

  @ViewChild('messages') messages!: ElementRef<HTMLDivElement>;

  conversation$ = this.store.select(selectActiveConversation).pipe(
    filter((conversation) => !!conversation),
    map((conversation) => {
      return {
        ...conversation,
        messages: [...conversation.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }
    }),
    tap(() => setTimeout(() => this.scrollToBottom(), 100)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  toUser$ = this.conversation$.pipe(
    switchMap((conversation) => this.store.select(selectWalletAddress).pipe(
      filter((walletAddress) => !!walletAddress),
      map((walletAddress) =>
        conversation.members.find((member) =>
          member.identifier?.toLowerCase() !== walletAddress?.toLowerCase())?.identifier
      )
    ))
  );

  error = signal<string | null>(null);
  messageInput: FormControl<string | null> = new FormControl(null);

  constructor(
    private store: Store<GlobalState>,
    private chatSvc: ChatService,
  ) {}

  async sendMessage($event: Event, conversation: NormalizedConversationWithMessages) {
    $event.preventDefault();
    const message = this.messageInput.value;
    if (!message) return;

    try {
      await this.chatSvc.sendMessageToConversation(conversation.id, message);
    } catch (error) {
      console.log('Error sending message', error);
    }

    this.messageInput.setValue(null);
    this.scrollToBottom();
  }

  goBack() {
    this.store.dispatch(setChat({ active: true }));
    this.store.dispatch(setActiveConversation({ conversation: undefined }));
  }

  scrollToBottom() {
    this.messages.nativeElement.scrollTop = this.messages.nativeElement.scrollHeight;
  }
}
