import { Component } from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';

import { Store } from '@ngrx/store';

import { GlobalState } from '@/models/global-state';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe
  ],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss'
})
export class StatusBarComponent {

  currentBlock$ = this.store.select(appStateSelectors.selectBlockNumber);

  constructor(
    private store: Store<GlobalState>,
  ) {}
}
