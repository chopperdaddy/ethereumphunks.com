import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';

import { Store } from '@ngrx/store';
import { map, tap, filter, switchMap, share, shareReplay } from 'rxjs';

import { ChatService } from '@/services/chat.service';
import { PageContextService } from '@/services/page-context.service';

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
    private pageContextSvc: PageContextService,
  ) {}

  async sendMessage($event: Event, conversation: NormalizedConversationWithMessages) {
    $event.preventDefault();
    const message = this.messageInput.value;
    if (!message) return;

    try {
      // Get current page context using the async method
      const pageContext = await this.pageContextSvc.getCurrentPageContextAsync();

      try {
        await this.chatSvc.sendMessageWithPageContext(conversation.id, message, pageContext);
        // console.log('Message sent with context:', pageContext);
      } catch (error) {
        console.log('Error sending message with context, trying without:', error);
        // Fallback to sending without context
        await this.chatSvc.sendMessageToConversation(conversation.id, message);
      }
    } catch (error) {
      console.log('Error getting page context or sending message:', error);
      // Fallback to sending without context
      try {
        await this.chatSvc.sendMessageToConversation(conversation.id, message);
      } catch (fallbackError) {
        console.error('Failed to send message even without context:', fallbackError);
      }
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
