import { Component } from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';

import { Store } from '@ngrx/store';

import { GlobalState } from '@/models/global-state';

import { combineLatest, tap } from 'rxjs';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe
  ],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {

  blocks$ = combineLatest([
    this.store.select(appStateSelectors.selectCurrentBlock),
    this.store.select(appStateSelectors.selectIndexerBlock)
  ]).pipe(
    tap(([currentBlock, indexerBlock]) => console.log({ currentBlock, indexerBlock })),
  );

  levels: any = {
    0: 'sync',
    1: 'behind1',
    2: 'behind2',
    3: 'behind3'
  };

  constructor(
    private store: Store<GlobalState>,
  ) {}
}
