import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location } from '@angular/common';

import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';

import { DataService } from '@/services/data.service';
import { GlobalState } from '@/models/global-state';

import { addRemoveTraitFilter } from '@/state/actions/app-state.actions';
import { selectActiveTraitFilters } from '@/state/selectors/app-state.selectors';
import { tap } from 'rxjs';

@Component({
  selector: 'app-market-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule
  ],
  templateUrl: './market-filters.component.html',
  styleUrls: ['./market-filters.component.scss']
})

export class MarketFiltersComponent {

  activeFiltersModel: any = {};

  traitCount!: number;

  objectKeys = Object.keys;

  activeTraitFilters$ = this.store.select(selectActiveTraitFilters).pipe(
    tap((filters) => this.activeFiltersModel = { ...filters }),
  );

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    private location: Location,
  ) {}

  selectFilter($event: any, key: string): void {
    // console.log('selectFilter', $event, key);

    this.store.dispatch(addRemoveTraitFilter({ traitFilter: { key, value: $event }}));

    // const filters = { ...this.activeFiltersModel };
    // for (let prop in filters) {
    //   if (filters[prop] === null) delete filters[prop];
    // }

    // let params = new HttpParams();
    // Object.keys(filters).map((key) => {
    //   if (filters[key]) params = params.append(key, filters[key]);
    // });

    // this.location.go(this.location.path().split('?')[0], params.toString());
    // this.activeFiltersModel = { ...filters };
    // this.activeFilters.next(this.activeFiltersModel);
  }

}
