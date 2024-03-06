import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TimeagoModule } from 'ngx-timeago';

import { ChatService } from '@/services/chat.service';
import { DataService } from '@/services/data.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { from, map, switchMap, tap } from 'rxjs';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { ImagePipe } from '@/pipes/image.pipe';
import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';
import { setToUser } from '@/state/actions/chat.actions';

@Component({
  imports: [
    AsyncPipe,
    JsonPipe,

    ImagePipe,

    TimeagoModule,
    LazyLoadImageModule,

    WalletAddressDirective,
  ],
  selector: 'app-conversations',
  standalone: true,
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.scss'
})
export class ConversationsComponent implements OnInit {

  @Input() withUser!: string;
  @Output() setConversation: EventEmitter<string> = new EventEmitter();

  convosLength = 0;

  conversations$ = from(this.chatSvc.getConversations()).pipe(
    switchMap((convos: any[]) => {
      const addresses = convos.map(convo => convo.peerAddress.toLowerCase());
      return this.dataSvc.addressesAreHolders(addresses).pipe(
        map((allowed) => {
          const allowedAddresses = allowed.map((res: any) => res.address);
          this.convosLength = allowedAddresses.length;

          return convos.filter((convo) => {
            return allowedAddresses.includes(convo.peerAddress.toLowerCase());
          }).map(convo => ({
            topic: convo.topic,
            peerAddress: convo.peerAddress,
            timestamp: new Date(convo.createdAt).getTime(),
            profileItem: allowed.filter((res: any) => res.address === convo.peerAddress.toLowerCase())[0]?.item,
          })).sort((a, b) => b.timestamp - a.timestamp)
        })
      )
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    private dataSvc: DataService,
    private chatSvc: ChatService
  ) {}

  ngOnInit() {}

  selectConversation(convo: any) {
    this.store.dispatch(setToUser({ address: convo.peerAddress }));
  }
}
