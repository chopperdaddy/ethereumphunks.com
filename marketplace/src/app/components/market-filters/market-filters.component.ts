import { Component, effect, input, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';

import { DataService } from '@/services/data.service';
import { GlobalState } from '@/models/global-state';

import { setActiveTraitFilters } from '@/state/market/market-state.actions';
import { selectActiveTraitFilters } from '@/state/market/market-state.selectors';

import { filter, tap, debounceTime, Subject, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    TitleCasePipe,
  ],
  selector: 'app-market-filters',
  templateUrl: './market-filters.component.html',
  styleUrls: ['./market-filters.component.scss']
})

export class MarketFiltersComponent implements OnDestroy {

  slug = input.required<string | undefined>();

  filterData = signal<{ [key: string]: string[] | number[] }>({});
  traitCount!: number;
  objectKeys = Object.keys;

  activeTraitFilters: any = {};
  rangeFilters: { [key: string]: { min: number; max: number; selectedMin: number; selectedMax: number } } = {};

  // Debouncing for range slider changes
  private rangeChangeSubject = new Subject<{ key: string; type: 'min' | 'max'; value: number }>();
  private rangeChangeSubscription?: Subscription;
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
    // Set up debounced range change handling
    this.rangeChangeSubscription = this.rangeChangeSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed()
    ).subscribe(({ key, type, value }) => {
      this.applyRangeChange(key, type, value);
    });

    effect(async () => {
      const slug = this.slug();
      if (!slug) {
        this.filterData.set({});
        return;
      }

      try {
        const filters = await this.dataSvc.getFilters(slug);
        console.log('filters', filters);
        this.filterData.set(filters || {});

        // Initialize range filters after data is loaded
        setTimeout(() => this.initializeRangeFilters(), 0);
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

  // Check if a filter key contains all numeric values
  isNumericFilter(key: string): boolean {
    const values = this.filterData()[key];
    return values && values.length > 0 && values.every(value => typeof value === 'number');
  }

  // Initialize range filters for numeric attributes
  initializeRangeFilters(): void {
    const data = this.filterData();
    Object.keys(data).forEach(key => {
      if (this.isNumericFilter(key)) {
        const numericValues = data[key] as number[];
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);

        // Check if there's an existing filter value from URL
        let selectedMin = min;
        let selectedMax = max;

        const existingFilter = this.activeTraitFilters[key];
        if (existingFilter && typeof existingFilter === 'string' && existingFilter.includes('-')) {
          const [minStr, maxStr] = existingFilter.split('-');
          const parsedMin = parseInt(minStr, 10);
          const parsedMax = parseInt(maxStr, 10);

          if (!isNaN(parsedMin) && !isNaN(parsedMax)) {
            selectedMin = Math.max(min, parsedMin);
            selectedMax = Math.min(max, parsedMax);
          }
        }

        this.rangeFilters[key] = {
          min,
          max,
          selectedMin,
          selectedMax
        };
      }
    });
  }

    // Handle range slider changes (debounced)
  onRangeChange(key: string, type: 'min' | 'max', value: number): void {
    if (this.rangeFilters[key]) {
      const range = this.rangeFilters[key];

      // Update the local state immediately for responsive UI
      if (type === 'min') {
        range.selectedMin = Math.min(value, range.selectedMax);
      } else {
        range.selectedMax = Math.max(value, range.selectedMin);
      }

      // Send to debounced subject instead of applying immediately
      this.rangeChangeSubject.next({ key, type, value });
    }
  }

  // Apply the actual range change (called after debounce)
  private applyRangeChange(key: string, type: 'min' | 'max', value: number): void {
    if (this.rangeFilters[key]) {
      const range = this.rangeFilters[key];

      // Update active filters with range
      const { selectedMin, selectedMax, min, max } = range;

      // Only set filter if range is not the full range
      if (selectedMin > min || selectedMax < max) {
        this.activeTraitFilters[key] = `${selectedMin}-${selectedMax}`;
      } else {
        delete this.activeTraitFilters[key];
      }

      this.selectFilter(null);
    }
  }

  clearFilters() {
    const activeParams = this.route.snapshot.queryParams;
    const newParams = activeParams.address ? { address: activeParams.address } : {};

    // Reset range filters
    Object.keys(this.rangeFilters).forEach(key => {
      const range = this.rangeFilters[key];
      range.selectedMin = range.min;
      range.selectedMax = range.max;
    });

    this.router.navigate([], { queryParams: newParams });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.rangeChangeSubscription?.unsubscribe();
    this.rangeChangeSubject.complete();
  }
}
