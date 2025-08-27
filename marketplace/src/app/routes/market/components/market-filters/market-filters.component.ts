import { Component, effect, input, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';

import { NgSelectModule } from '@ng-select/ng-select';
import { NgxSliderModule, Options, ChangeContext } from '@angular-slider/ngx-slider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, tap, debounceTime, Subject, Subscription } from 'rxjs';

import { DataService } from '@/services/data.service';
import { GlobalState } from '@/models/global-state';

import * as appStateActions from '@/state/app/app-state.actions';
import { setActiveTraitFilters } from '@/state/market/market-state.actions';
import { selectActiveTraitFilters } from '@/state/market/market-state.selectors';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    NgxSliderModule,
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

  // Toggle state for individual numeric filter dropdowns
  numericDropdownStates: { [key: string]: boolean } = {};

  // Debouncing for range slider changes
  private rangeChangeSubject = new Subject<{ key: string; type: 'min' | 'max'; value: number }>();
  private rangeChangeSubscription?: Subscription;

  // Active trait filters from store
  activeTraitFilters$ = this.store.select(selectActiveTraitFilters).pipe(
    filter((filters) => !!filters),
    tap((filters) => {
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
    private actions$: Actions,
  ) {
    // Set up debounced range change handling
    this.rangeChangeSubscription = this.rangeChangeSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed()
    ).subscribe(({ key, type, value }) => {
      this.applyRangeChange(key, type, value);
    });

    // Listen to global mouseDown actions to close dropdowns when clicking outside
    this.actions$.pipe(
      ofType(appStateActions.mouseDown),
      takeUntilDestroyed()
    ).subscribe((action) => {
      const target = action.event.target as HTMLElement;

      // Check if any dropdowns are open
      const hasOpenDropdowns = Object.values(this.numericDropdownStates).some(isOpen => isOpen);

      if (hasOpenDropdowns) {
        // Check if click was on a dropdown trigger (to allow toggling)
        const isDropdownTrigger = target.closest('.numeric-dropdown-trigger');

        // Check if click was inside any dropdown content
        const isInsideDropdownContent = target.closest('.numeric-dropdown-content');

        // Close dropdowns if click was not on trigger or inside dropdown content
        if (!isDropdownTrigger && !isInsideDropdownContent) {
          this.closeAllNumericDropdowns();
        }
      }
    });

    effect(async () => {
      const slug = this.slug();
      if (!slug) {
        this.filterData.set({});
        return;
      }

      try {
        const filters = await this.dataSvc.getFilters(slug);
        // console.log('filters', filters);
        this.filterData.set(filters || {});

        // Initialize range filters after data is loaded
        setTimeout(() => this.initializeRangeFilters(), 0);
      } catch (error) {
        console.error('Failed to load filters:', error);
        this.filterData.set({});
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.rangeChangeSubscription?.unsubscribe();
    this.rangeChangeSubject.complete();
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

  // Get slider options for ngx-slider
  getSliderOptions(key: string): Options {
    const range = this.rangeFilters[key];
    if (!range) return {};

    return {
      floor: range.min,
      ceil: range.max,
      step: 1,
      noSwitching: true,
      animate: false,
      showTicks: false,
      showTicksValues: false,
      showSelectionBar: true,
      hideLimitLabels: true,
      hidePointerLabels: false,
      stepsArray: undefined,
      translate: (value: number): string => value.toString()
    };
  }

  // Handle slider changes from ngx-slider
  onSliderChange(key: string, changeContext: ChangeContext): void {
    if (this.rangeFilters[key] && changeContext.value !== undefined && changeContext.highValue !== undefined) {
      const range = this.rangeFilters[key];

      // Update the range values
      range.selectedMin = changeContext.value;
      range.selectedMax = changeContext.highValue;

      // Send to debounced subject for processing
      this.rangeChangeSubject.next({ key, type: 'min', value: changeContext.value });
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

  // Toggle individual numeric filter dropdown
  toggleNumericFilter(key: string): void {
    this.numericDropdownStates[key] = !this.numericDropdownStates[key];
  }

  // Check if a specific numeric filter dropdown is open
  isNumericDropdownOpen(key: string): boolean {
    return !!this.numericDropdownStates[key];
  }

  // Check if a specific numeric filter is active
  isNumericFilterActive(key: string): boolean {
    const range = this.rangeFilters[key];
    return range && (range.selectedMin > range.min || range.selectedMax < range.max);
  }

  removeNumericFilter(key: string): void {
    delete this.activeTraitFilters[key];

    // Reset the range filter values to full range
    if (this.rangeFilters[key]) {
      const range = this.rangeFilters[key];
      range.selectedMin = range.min;
      range.selectedMax = range.max;
    }

    this.selectFilter(null);
  }

  // Close all numeric filter dropdowns
  closeAllNumericDropdowns(): void {
    this.numericDropdownStates = {};
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

    // Close all numeric filter dropdowns
    this.closeAllNumericDropdowns();

    this.router.navigate([], { queryParams: newParams });
  }
}
