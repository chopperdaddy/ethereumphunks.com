import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';
import { NgSelectModule } from '@ng-select/ng-select';

import { VisualDataComponent } from './visual-data/visual-data.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { DataService } from '@/services/data.service';
import { StateService } from '@/services/state.service';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FilterPipe } from '@/pipes/filter.pipe';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { BehaviorSubject, Subject, switchMap, takeUntil, tap } from 'rxjs';

import { Event, EventType } from '@/models/graph';

interface TxFilterItem { label: string, value: EventType };

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,

    VisualDataComponent,
    WalletAddressDirective,

    TokenIdParsePipe,
    WeiToEthPipe,
    FilterPipe,
    CalcPipe,
    FormatCashPipe
  ],
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class TxOverviewComponent implements OnDestroy {

  private events = new BehaviorSubject<Event[] | null>(null);
  events$ = this.events.asObservable();

  private topSales = new BehaviorSubject<Event[] | null>(null);
  topSales$ = this.topSales.asObservable();

  private destroy$ = new Subject<void>();

  txFilters: TxFilterItem[] = [
    { label: 'All', value: 'All' },
    { label: 'Bid Entered', value: 'BidEntered' },
    { label: 'Bid Withdrawn', value: 'BidWithdrawn' },
    // { label: 'Claimed', value: 'Claimed' },
    { label: 'Offer Withdrawn', value: 'OfferWithdrawn' },
    { label: 'Offered', value: 'Offered' },
    { label: 'Sale', value: 'Sale' },
    { label: 'Transferred', value: 'Transferred' },
    { label: 'Unwrapped', value: 'Unwrapped' },
    { label: 'Wrapped', value: 'Wrapped' },
  ];

  _activeTxFilter: string = this.txFilters[0].value;
  private activeTxFilter = new BehaviorSubject<TxFilterItem>(this.txFilters[0]);
  activeTxFilter$ = this.activeTxFilter.asObservable();

  labels: any = {
    BidEntered: 'New bid of',
    BidWithdrawn: 'Bid withdrawn',
    OfferWithdrawn: 'Offer withdrawn',
    Offered: 'Offered for',
    Sale: 'Bought for',
    Transferred: 'Transferred to',
    Unwrapped: 'Unwrapped by',
    Wrapped: 'Wrapped by',
  };

  constructor(
    public dataSvc: DataService,
    public stateSvc: StateService
  ) {
    
    this.dataSvc.fetchTopSales(12).pipe(
      tap((topSales: Event[]) => this.topSales.next(topSales)),
      takeUntil(this.destroy$)
    ).subscribe();

    this.activeTxFilter$.pipe(
      // tap((res) => console.log('activeTxFilter', res)),
      switchMap((filter: TxFilterItem) => this.dataSvc.fetchEvents(12, filter.value)),
      tap((events: Event[]) => this.events.next(events)),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  trackByFn(i: number, item: any): string {
    return item.tokenId;
  }

  setActiveTxFilter(filter: TxFilterItem): void {
    this.activeTxFilter.next(filter);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
