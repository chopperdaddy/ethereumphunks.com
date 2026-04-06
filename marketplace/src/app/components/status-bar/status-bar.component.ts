import { Component, effect, input, signal, untracked } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/app/app-state.selectors';

import { GasService } from '@/services/gas.service';

import { combineLatest, firstValueFrom, map } from 'rxjs';

import { ChatComponent } from '@/components/chat/chat.component';
import { LoggerComponent } from '@/components/logger/logger.component';

import { setLogsActive } from '@/state/indexer-logs/indexer-logs.actions';
import { setChat } from '@/state/chat/chat.actions';

import { selectLogsActive } from '@/state/indexer-logs/indexer-logs.selectors';
import { selectChat, selectUnreadCount } from '@/state/chat/chat.selectors';

import { environment } from '@environments/environment';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    NgTemplateOutlet,

    ChatComponent,
    LoggerComponent
  ],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {

  blocks$ = combineLatest([
    this.store.select(appStateSelectors.selectCurrentBlock),
    this.store.select(appStateSelectors.selectIndexerBlock),
  ]);

  chain = environment.chainId;

  levels: any = {
    0: 'sync',
    1: 'behind1',
    2: 'behind2',
    3: 'behind3'
  };

  config$ = this.store.select(appStateSelectors.selectConfig);
  chatActive$ = this.store.select(selectChat).pipe(map(({ active }) => active));
  logsActive$ = this.store.select(selectLogsActive);
  unreadCount$ = this.store.select(selectUnreadCount);

  constructor(
    private store: Store<GlobalState>,
    public gasSvc: GasService
  ) {}

  async expandCollapse() {
    const expanded = await firstValueFrom(this.logsActive$);
    this.store.dispatch(setLogsActive({ logsActive: !expanded }));
  }

  async toggleChat() {
    const active = await firstValueFrom(this.chatActive$);
    this.store.dispatch(setChat({ active: !active }));
  }
}
