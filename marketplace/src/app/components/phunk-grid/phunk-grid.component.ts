import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

import { ViewType } from '@/models/view-types';
import { Phunk } from '@/models/graph';
import { MarketTypes, Sorts } from '@/models/pipes';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { SortPipe } from '@/pipes/sort.pipe';
import { PropertiesPipe } from '@/pipes/properties';

import { environment } from 'src/environments/environment';

import * as appStateSelectors from '@/state/selectors/app-state.selector';

import { filter, map } from 'rxjs';

@Component({
  selector: 'app-phunk-grid',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    NgxPaginationModule,
    IntersectionObserverModule,

    TokenIdParsePipe,
    WeiToEthPipe,
    FormatCashPipe,
    SortPipe,
    PropertiesPipe
  ],
  templateUrl: './phunk-grid.component.html',
  styleUrls: ['./phunk-grid.component.scss']
})

export class PhunkGridComponent implements OnChanges {

  @ViewChildren('phunkCheck') phunkCheck!: QueryList<ElementRef<HTMLInputElement>>;

  escrowAddress = environment.phunksMarketAddress;

  @Input() phunkData: Phunk[] = [];
  @Input() marketType!: MarketTypes;
  @Input() viewType: ViewType = 'market';
  @Input() limit: number = 110;
  @Input() sort!: Sorts;
  @Input() currentPage: number = 1;

  @Input() selectable: boolean = false;
  @Input() selectAll: boolean = false;

  @Output() selectedChange: EventEmitter<Phunk['hashId'][]> = new EventEmitter<Phunk['hashId'][]>();
  @Input() selected: Phunk['hashId'][] = [];

  traitCount!: number;
  limitArr = Array.from({length: this.limit}, (_, i) => i);

  activeTraitFilters$ = this.store.select(appStateSelectors.selectActiveTraitFilters);
  activeSort$ = this.store.select(appStateSelectors.selectActiveSort);
  marketType$ = this.store.select(appStateSelectors.selectMarketType).pipe(
    filter((type) => !!type),
    map((type) => this.marketType || type || 'all' as MarketTypes)
  );

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
  ) {}

  identify(index: number, item: Phunk) {
    return item.phunkId;
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes.selected && !changes.selected.firstChange) {
      this.phunkCheck?.forEach((checkbox) => {
        const hashId = checkbox.nativeElement.dataset.hashId;
        if (!hashId) return;

        checkbox.nativeElement.checked = this.selected.includes(hashId);
      });
    }

    if (changes.selectAll) {
      this.phunkCheck?.forEach((checkbox) => {
        checkbox.nativeElement.checked = this.selectAll;
        const hashId = checkbox.nativeElement.dataset.hashId;
        if (!hashId) return;
        this.selectPhunk(hashId, true, !this.selectAll);
      });
    }
  }

  selectPhunk(hashId: Phunk['hashId'], upsert: boolean = false, remove: boolean = false) {
    if (remove) {
      this.selected = this.selected.filter(item => item !== hashId);
      this.selected = [...this.selected];
      this.selectedChange.emit(this.selected);
      return;
    }

    if (upsert) {
      if (!this.selected.includes(hashId)) this.selected.push(hashId);
    } else {
      if (this.selected.includes(hashId)) this.selected = this.selected.filter(item => item !== hashId);
      else this.selected.push(hashId);
    }

    this.selected = [...this.selected];
    this.selectedChange.emit(this.selected);
  }

  scrollingDown: boolean = false;
  prevIndex: number | null = null;

  onIntersection($event: IntersectionObserverEntry[]): void {
    if (this.viewType !== 'market') return;
    if (this.limit >= this.phunkData.length) return;

    $event.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target as HTMLElement;
        const index = Number(target.dataset.index);

        // If prevIndex hasn't been set yet, initialize it
        if (this.prevIndex === null) {
          this.prevIndex = index;
          return;
        }

        if (index > this.limit - 24) {
          this.limit += 24;
        }
      }
    });
  }
}
