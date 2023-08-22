import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { NgSelectModule } from '@ng-select/ng-select';

import { ViewType } from '@/models/view-types';
import { Punk } from '@/models/graph';

import { DataService } from '@/services/data.service';
import { StateService } from '@/services/state.service';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { FilterPipe } from '@/pipes/filter.pipe';
import { SortPipe } from '@/pipes/sort.pipe';
import { CountPipe } from '@/pipes/count.pipe';
import { PropertiesPipe } from '@/pipes/properties';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { Filters, Sorts, WrappedFilters } from '@/models/pipes';

import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-punk-grid-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    NgxPaginationModule,
    NgSelectModule,
    FormsModule,

    WalletAddressDirective,

    TokenIdParsePipe,
    WeiToEthPipe,
    FormatCashPipe,
    FilterPipe,
    SortPipe,
    CountPipe,
    PropertiesPipe
  ],
  templateUrl: './punk-grid-view.component.html',
  styleUrls: ['./punk-grid-view.component.scss']
})

export class PunkGridViewComponent implements AfterViewInit, OnChanges {

  private activeFilters = new BehaviorSubject({});
  activeFilters$ = this.activeFilters.asObservable();
  activeFiltersModel: any = {};

  sorts: { label: string, value: Sorts }[] = [
    { label: 'Price Low', value: 'price-low' },
    { label: 'Price High', value: 'price-high' },
    { label: 'Recent', value: 'recent' },
    { label: 'Token ID', value: 'id' }
  ];
  private activeSort = new BehaviorSubject(this.sorts[0]);
  activeSort$ = this.activeSort.asObservable();
  activeSortModel: any = this.sorts[0];

  wrappedFilters: WrappedFilters[] = ['All', 'Wrapped', 'Unwrapped'];
  activeWrappedFilterModel: WrappedFilters = this.wrappedFilters[0];
  private activeWrappedFilters = new BehaviorSubject(this.wrappedFilters[0]);
  activeWrappedFilters$ = this.activeWrappedFilters.asObservable();

  @Input() punkData: Punk[] = [];
  @Input() viewType: ViewType = 'medium';
  @Input() limit: number = 110;
  @Input() marketType: Filters = 'all';
  @Input() sort!: Sorts;
  @Input() address!: string;

  currentPage: number = 1;
  filtersVisible: boolean = false;

  traitCount!: number;

  objectKeys = Object.keys;
  limitArr = Array.from({length: this.limit}, (_, i) => i);
  marketTitles: any = {
    all: 'All EthPhunks',
    listings: 'EthPhunks for Sale',
    bids: 'Current Bids',
    owned: 'EthPhunks Owned'
  };

  constructor(
    public dataSvc: DataService,
    public stateSvc: StateService,
    private location: Location,
    private route: ActivatedRoute
  ) {}

  ngAfterViewInit(): void {
    const routeParams = this.route.snapshot.queryParams;
    if (Object.keys(routeParams).length && !routeParams?.address) {
      this.activeFiltersModel = { ...routeParams };
      this.activeFilters.next(this.activeFiltersModel);
      this.filtersVisible = true;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // console.log(changes);
    if (changes?.sort?.currentValue) {
      const activeSort = this.sorts.find((sort) => sort.value === this.sort);
      this.setSort(activeSort);
      this.activeSortModel = activeSort;
    }
  }

  identify(index: number, item: any) {
    return item.id;
  }

  selectFilter($event: any, key: string): void {

    const filters = { ...this.activeFiltersModel };
    for (let prop in filters) {
      if (filters[prop] === null) delete filters[prop];
    }

    let params = new HttpParams();
    Object.keys(filters).map((key) => {
      if (filters[key]) params = params.append(key, filters[key]);
    });

    this.location.go(this.location.path().split('?')[0], params.toString());
    this.activeFiltersModel = { ...filters };
    this.activeFilters.next(this.activeFiltersModel);
  }

  setSort($event: any): void {
    this.activeSort.next({ ...$event });
  }

  setWrappedFilter($event: any): void {
    this.activeWrappedFilters.next($event);
  }

  pageChanged($event: any) {
    this.currentPage = $event;
  }

}
