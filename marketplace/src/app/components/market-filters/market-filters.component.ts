import { Component, effect, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';

import { DataService } from '@/services/data.service';
import { IsNumberPipe } from '@/pipes/is-number.pipe';
import { GlobalState } from '@/models/global-state';

import { setActiveTraitFilters } from '@/state/market/market-state.actions';
import { selectActiveTraitFilters } from '@/state/market/market-state.selectors';

import { filter, tap } from 'rxjs';
@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    IsNumberPipe,
    TitleCasePipe,
  ],
  selector: 'app-market-filters',
  templateUrl: './market-filters.component.html',
  styleUrls: ['./market-filters.component.scss']
})

export class MarketFiltersComponent {

  slug = input.required<string | undefined>();

  filterData = signal<{ [key: string]: string[] | number[] }>({});
  traitCount!: number;
  objectKeys = Object.keys;

  activeTraitFilters: any = {};
  activeTraitFilters$ = this.store.select(selectActiveTraitFilters).pipe(
    filter((filters) => !!filters),
    tap((filters) => {
      console.log('filters', filters);
      const newFilters = { ...filters };
      delete newFilters.address;
      this.activeTraitFilters = { ...newFilters };
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    effect(async () => {
      const slug = this.slug();
      if (!slug) {
        this.filterData.set({});
        return;
      }

      try {
        const filters = await this.dataSvc.getFilters(slug);
        this.filterData.set(filters || {});
      } catch (error) {
        console.error('Failed to load filters:', error);
        this.filterData.set({});
      }
    });
  }

  selectFilter($event: any): void {
    const filters = { ...this.activeTraitFilters };
    let urlParams = new HttpParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] === null) delete filters[key];
      if (filters[key]) urlParams = urlParams.append(key, filters[key]);
    });

    this.location.go(this.location.path().split('?')[0], urlParams.toString());
    this.store.dispatch(setActiveTraitFilters({ traitFilters: { ...filters } }));
  }

  clearFilters() {
    const activeParams = this.route.snapshot.queryParams;
    const newParams = activeParams.address ? { address: activeParams.address } : {};
    this.router.navigate([], { queryParams: newParams });
  }
}
