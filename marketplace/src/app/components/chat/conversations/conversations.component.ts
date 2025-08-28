import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { async, combineLatest, filter, map, tap, withLatestFrom } from 'rxjs';

import { GlobalState } from '@/models/global-state';

import { AvatarComponent } from "@/components/avatar/avatar.component";
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { selectConversations, selectUnreadConversations } from '@/state/chat/chat.selectors';

import { setChat, setCreateConversationWithAddress } from '@/state/chat/chat.actions';
import { ChatService } from '@/services/chat.service';
import { Web3Service } from '@/services/web3.service';

import { environment } from '@environments/environment';
import { selectWalletAddress } from '@/state/app/app-state.selectors';
import { NormalizedConversation } from '@/models/chat';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    TimeagoModule,
    LazyLoadImageModule,
    ReactiveFormsModule,
    NgTemplateOutlet,

    WalletAddressDirective,
    AvatarComponent
],
  selector: 'app-conversations',
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.scss'
})
export class ConversationsComponent {

  @ViewChild('newConversationToInput') newConversationToInput!: ElementRef<HTMLInputElement>;

  agentAddress = environment.agent.address.toLowerCase();

  conversations$ = combineLatest([
    this.store.select(selectConversations),
    this.store.select(selectUnreadConversations)
  ]).pipe(
    map(([conversations, unreadConversations]) => {
      if (!conversations) return [];
      return [...conversations].map((conversation) => {
        return { ...conversation, unreadCount: unreadConversations?.[conversation.id] ?? 0 };
      }).sort((a, b) => {
        const agentAddress = environment.agent.address.toLowerCase();
        const aAddress = a.members[0]?.identifier?.toLowerCase();
        const bAddress = b.members[0]?.identifier?.toLowerCase();

        // Agent conversations always come first
        const aIsAgent = aAddress === agentAddress;
        const bIsAgent = bAddress === agentAddress;

        if (aIsAgent && !bIsAgent) return -1;
        if (!aIsAgent && bIsAgent) return 1;

        // If neither or both are agent, sort by timestamp (most recent first)
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
    }),
    // tap((conversations) => console.log({conversations}))
  );

  unreadConversations$ = this.store.select(selectUnreadConversations).pipe(
    withLatestFrom(this.conversations$),
    map(([unreadConversations, conversations]) => {
      return conversations.map((conversation) => {
        return { ...conversation, unreadCount: unreadConversations?.[conversation.id] ?? 0 };
      });
    })
  );

  walletAddress$ = this.store.select(selectWalletAddress);

  isCreatingNewConversation = signal(false);
  newConversationTo: FormControl<string | null> = new FormControl(null);

  constructor(
    private store: Store<GlobalState>,
    public chatSvc: ChatService,
    private web3Svc: Web3Service
  ) {}

  newConversation() {
    this.isCreatingNewConversation.set(true);
    setTimeout(() => this.newConversationToInput.nativeElement.focus(), 100);
  }

  closeNewConversation() {
    this.newConversationTo.reset();
    this.isCreatingNewConversation.set(false);
  }

  async createConversation($event: Event) {
    $event.preventDefault();
    if (!this.newConversationTo.value) return;

    const verifiedAddress = await this.web3Svc.verifyAddressOrEns(this.newConversationTo.value!);
    if (!verifiedAddress) return;

    this.store.dispatch(setCreateConversationWithAddress({ address: verifiedAddress }));
    this.closeNewConversation();
  }

  goToConversation(conversationId: string) {
    this.store.dispatch(setChat({
      active: true,
      activeConversationId: conversationId
    }));
  }
}
