import { Component, input } from '@angular/core';
import { AsyncPipe, DecimalPipe, LowerCasePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { from, map, switchMap, tap } from 'rxjs';
import { Store } from '@ngrx/store';

import { selectConfig, selectWalletAddress } from '@/state/app/app-state.selectors';
import { setCreateConversationWithAddress } from '@/state/chat/chat.actions';

import { GlobalState } from '@/models/global-state';
import { MarketType } from '@/models/market.state';
import { Collection } from '@/models/data.state';
import { Phunk } from '@/models/db';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { ChatService } from '@/services/chat.service';

import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    LowerCasePipe,
    NgTemplateOutlet,

    RouterModule,
    WalletAddressDirective,
  ],
  selector: 'app-market-header',
  templateUrl: './market-header.component.html',
  styleUrls: ['./market-header.component.scss']
})
export class MarketHeaderComponent {

  env = environment;

  marketTitles: { [key in MarketType]: string } = {
    all: 'All %collectionName%s',
    listings: ' %collectionName%s for Sale',
    bids: 'Current Bids',
    owned: ' %collectionName%s Owned',
    activity: 'Activity',
    auctions: 'Auctions',
    // user: 'Owned Inscriptions',
  };

  marketType = input.required<MarketType>();
  collection = input.required<Collection>();
  phunkData = input.required<{ data: Phunk[]; total: number; }>();

  config$ = this.store.select(selectConfig);
  walletAddress$ = this.store.select(selectWalletAddress).pipe(
    tap((address) => console.log('walletAddress$', address))
  );

  routeParamAddress$ = this.route.queryParams.pipe(
    map((params) => params['address'])
  );

  isChattable$ = this.routeParamAddress$.pipe(
    switchMap((address) => from(this.chatSvc.checkIfUserIsOnNetwork(address))),
  )

  constructor(
    private store: Store<GlobalState>,
    private route: ActivatedRoute,
    private chatSvc: ChatService
  ) {}

  /**
   * Initiates the creation of a chat conversation with a specific address
   * @param address - The wallet address to start a conversation with
   */
  async createConversation(address: string) {
    this.store.dispatch(setCreateConversationWithAddress({ address }));
  }
}
