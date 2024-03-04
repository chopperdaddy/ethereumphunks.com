import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';

import { ChatService } from '@/services/chat.service';

import { BehaviorSubject, Observable, catchError, filter, from, map, of, scan, startWith, switchMap, tap } from 'rxjs';

import { Message } from '@/models/chat';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

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
export class ConversationComponent implements OnChanges {

  @ViewChild('messages') messages!: ElementRef<HTMLDivElement>;

  @Input() withUser!: string;
  @Input() standalone = false;

  @Output() goBack: EventEmitter<void> = new EventEmitter<void>();

  messageInput: FormControl<string | null> = new FormControl(null);

  private user = new BehaviorSubject<string>('');
  user$ = this.user.asObservable();

  conversations$: Observable<any[]> = of([]);

  messages$: Observable<Message[]> = this.user$.pipe(
    tap(user => console.log('user', user)),
    filter(user => !!user),
    switchMap(user =>
      from(this.chatSvc.createConversationWithUser(user)).pipe(
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
        tap(messages => console.log('messages', messages)),
        map((messages: any[]) => messages.map(message => ({
          id: message.id,
          sender: message.senderAddress,
          content: message.content || message.contentFallback,
          self: message.senderAddress.toLowerCase() !== this.withUser?.toLowerCase(),
          timestamp: new Date(message.sent).getTime(),
        }))),
        tap(messages => {
          setTimeout(() => {
            const el = this.messages.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
          }, 0);
        }),
        catchError(err => {
          console.error('Error creating conversation', err);
          return of([]);
        })
      )
    )
  );

  constructor(
    private chatSvc: ChatService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    console.log({ changes });
    if (
      changes.withUser &&
      changes.withUser.currentValue &&
      changes.withUser.currentValue !== changes.withUser.previousValue
    ) {
      this.user.next(this.withUser);
    }
  }

  async sendMessage($event: Event) {
    $event.preventDefault();

    try {
      await this.chatSvc.sendMessage(this.withUser, this.messageInput.value);
    } catch (error) {
      console.log('Error sending message', error);
    }

    this.messageInput.setValue(null);
  }
}
