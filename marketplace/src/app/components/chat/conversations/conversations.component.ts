import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { GlobalState } from '@/models/global-state';

import { AvatarComponent } from "@/components/avatar/avatar.component";
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { selectConversations } from '@/state/chat/chat.selectors';

import { setChat, setCreateConversationWithAddress } from '@/state/chat/chat.actions';
import { ChatService } from '@/services/chat.service';
import { Web3Service } from '@/services/web3.service';
import { tap } from 'rxjs';
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

  conversations$ = this.store.select(selectConversations).pipe(
    tap((conversations) => {
      console.log('ConversationsComponent:conversations', conversations);
    })
  );

  isCreatingNewConversation = signal(false);
  newConversationTo: FormControl<string | null> = new FormControl(null);

  constructor(
    private store: Store<GlobalState>,
    private chatSvc: ChatService,
    private web3Svc: Web3Service
  ) {}

  newConversation() {
    console.log('createConversation');
    this.isCreatingNewConversation.set(true);
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
