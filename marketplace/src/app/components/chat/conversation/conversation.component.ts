import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';

import { ChatService } from '@/services/chat.service';

import { BehaviorSubject, Observable, catchError, filter, from, map, of, scan, startWith, switchMap, tap } from 'rxjs';

import { Message } from '@/models/chat';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { selectToUser } from '@/state/selectors/chat.selectors';
import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';
import { setToUser } from '@/state/actions/chat.actions';

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe,
    DatePipe,
    NgTemplateOutlet,

    ReactiveFormsModule,
    TimeagoModule,

    WalletAddressDirective
  ],
  templateUrl: './conversation.component.html',
  styleUrl: './conversation.component.scss'
})
export class ConversationComponent {

  @ViewChild('messages') messages!: ElementRef<HTMLDivElement>;

  error!: string | null;

  messageInput: FormControl<string | null> = new FormControl(null);

  private user = new BehaviorSubject<string>('');
  user$ = this.user.asObservable();

  conversations$: Observable<any[]> = of([]);

  toUser$ = this.store.select(selectToUser);
  messages$: Observable<Message[]> = this.store.select(selectToUser).pipe(
    filter((user) => !!user),
    switchMap((user) =>
      from(this.chatSvc.createConversationWithUser(user!)).pipe(
        switchMap(conversation =>
          from(this.chatSvc.getChatMessagesFromConversation(conversation)).pipe(
            switchMap(pastMessages =>
              this.chatSvc.streamMessages(conversation).pipe(
                map(currentMessage => [currentMessage]),
                startWith(pastMessages),
                scan((acc: Message[], currentMessages: Message[]) => [...acc, ...currentMessages], [])
              )
            )
          )
        ),
        map((messages: any[]) => messages.map((message) => ({
          id: message.id,
          sender: message.senderAddress,
          content: message.content || message.contentFallback,
          self: message.senderAddress.toLowerCase() !== user?.toLowerCase(),
          timestamp: new Date(message.sent).getTime(),
        }))),
        tap((messages: Message[]) => {
          if (messages?.length) this.error = null;
          setTimeout(() => {
            const el = this.messages.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
          }, 0);
        }),
        catchError(err => {
          console.error('Error creating conversation', err);
          this.error = 'Error: ' + err?.message || 'Unknown error';
          return of([]);
        })
      )
    )
  );

  constructor(
    private store: Store<GlobalState>,
    private chatSvc: ChatService,
  ) {}

  async sendMessage($event: Event, toUser: string) {
    $event.preventDefault();

    try {
      await this.chatSvc.sendMessage(toUser, this.messageInput.value);
    } catch (error) {
      console.log('Error sending message', error);
    }

    this.messageInput.setValue(null);
  }

  goBack() {
    this.store.dispatch(setToUser({ address: null }));
  }
}
