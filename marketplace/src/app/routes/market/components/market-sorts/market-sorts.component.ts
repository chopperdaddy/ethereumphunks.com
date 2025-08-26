import { CommonModule } from '@angular/common';
import { Component, effect, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';

import { SortOption } from '@/models/sorts.model';;
import { GlobalState } from '@/models/global-state';
import { MarketType } from '@/models/market.state';
import { marketSorts, sortLabels } from '@/constants/sorts';
import { setActiveSort } from '@/state/market/market-state.actions';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    NgSelectModule,
    FormsModule,
  ],
  selector: 'app-market-sorts',
  templateUrl: './market-sorts.component.html',
  styleUrls: ['./market-sorts.component.scss']
})
export class MarketSortsComponent {

  marketType = input.required<MarketType>();
  activeSort = input.required<SortOption>();

  sorts = signal<SortOption[]>([]);
  activeSortOption = signal<SortOption | null>(null);

  sortLabels = sortLabels;

  constructor(
    private store: Store<GlobalState>,
  ) {
    effect(() => {
      const marketType = this.marketType();
      const activeSort = this.activeSort();

      untracked(() => {
        this.sorts.set(marketSorts[marketType]);
        this.activeSortOption.set(activeSort || null);
      });
    });
  }

  /**
   * Sets the active sort option for the market view
   * @param $event - The sort option selected by the user
   */
  setSort($event: SortOption): void {
    this.store.dispatch(setActiveSort({ activeSort: $event }));
  }
}
