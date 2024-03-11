import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

import { GlobalState, TraitFilter } from '@/models/global-state';
import { MarketType } from '@/models/market.state';
import { ViewType } from '@/models/view-types';
import { Phunk } from '@/models/db';
import { Sort } from '@/models/pipes';

import { DataService } from '@/services/data.service';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { SortPipe } from '@/pipes/sort.pipe';
import { PropertiesPipe } from '@/pipes/properties';
import { ImagePipe } from '@/pipes/image.pipe';

import { environment } from 'src/environments/environment';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { selectWalletAddress } from '@/state/selectors/app-state.selectors';
import * as marketStateActions from '@/state/actions/market-state.actions';

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
    PropertiesPipe,
    ImagePipe,
  ],
  host:  {
    '[class.selectable]': 'selectable',
    '[class]': 'viewType',
  },
  templateUrl: './phunk-grid.component.html',
  styleUrls: ['./phunk-grid.component.scss']
})

export class PhunkGridComponent implements OnChanges {

  @ViewChildren('phunkCheck') phunkCheck!: QueryList<ElementRef<HTMLInputElement>>;

  escrowAddress = environment.marketAddress;

  @Input() marketType!: MarketType;
  @Input() activeSort!: Sort['value'];

  @Input() viewType: ViewType = 'market';
  @Input() phunkData!: Phunk[];
  @Input() total: number = 0;
  @Input() limit: number = 0;

  @Input() showLabels: boolean = true;
  @Input() traitFilters!: TraitFilter | null;
  @Input() observe: boolean = false;

  @Input() selectable: boolean = false;
  @Input() selectAll: boolean = false;

  @Input() walletAddress!: string | null | undefined;

  @Output() selectedChange = new EventEmitter<{ [string: Phunk['hashId']]: Phunk }>();
  @Input() selected: { [string: Phunk['hashId']]: Phunk } = {};

  limitArr = Array.from({length: this.limit}, (_, i) => i);

  usd$ = this.store.select(dataStateSelectors.selectUsd);

  showLoadMore: boolean = false;

  constructor(
    private store: Store<GlobalState>,
    private el: ElementRef,
    public dataSvc: DataService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selected && !changes.selected.firstChange) {
      this.phunkCheck?.forEach((checkbox) => {
        const hashId = checkbox.nativeElement.dataset.hashId;
        if (!hashId) return;
        checkbox.nativeElement.checked = !!this.selected[hashId];
      });
    }

    if (changes.selectAll) {
      this.phunkCheck?.forEach((checkbox) => {
        if (!this.phunkData) return;
        checkbox.nativeElement.checked = this.selectAll;

        const hashId = checkbox.nativeElement.dataset.hashId;
        if (!hashId) return;

        const phunk = this.phunkData.find((phunk) => phunk.hashId === hashId);
        if (!phunk) return;
        this.selectPhunk(phunk, true, !this.selectAll);
      });
    }

    if (changes.traitFilters && !changes.traitFilters.firstChange) {
      this.limit = 250;
    }

    if (changes.total && this.childrenLength() === this.total) {
      this.showLoadMore = false;
    }
  }

  selectPhunk(
    phunk: Phunk,
    upsert: boolean = false,
    remove: boolean = false
  ) {
    if (remove) {
      const selected = { ...this.selected };
      delete selected[phunk.hashId];
      this.selected = selected;
      this.selectedChange.emit(this.selected);
      return;
    }

    if (upsert) {
      if (!this.selected[phunk.hashId]) this.selected[phunk.hashId] = phunk;
    } else {
      if (this.selected[phunk.hashId]) {
        const selected = { ...this.selected };
        delete selected[phunk.hashId];
        this.selected = selected;
      } else {
        this.selected[phunk.hashId] = phunk;
      }
    }

    this.selectedChange.emit(this.selected);
  }

  onIntersection($event: IntersectionObserverEntry[]): void {
    if (!this.observe || !this.phunkData) return;

    $event.forEach((entry) => {
      if (entry.isIntersecting) {

        const target = entry.target as HTMLElement;
        const index = Number(target.dataset.index) + 1;
        const limit = this.limit;

        // console.log({
        //   children: this.childrenLength(),
        //   index,
        //   limit,
        //   total: this.total,
        // });

        if (index >= (this.childrenLength() - 50)) {
          this.limit = this.limit >= this.total ? this.total : this.childrenLength() + 250;
        }

        this.showLoadMore = this.childrenLength() < this.limit || this.childrenLength() !== this.total;
      }
    });
  }

  loadMore() {
    if (this.marketType === 'all') {
      this.store.dispatch(
        marketStateActions.setPagination({
          pagination: {
            fromIndex: this.childrenLength() || 0,
            toIndex: this.limit >= this.total ? this.total : this.limit,
          }
        })
      );
    }
  }

  childrenLength() {
    return [...this.el.nativeElement.children].filter((child: HTMLElement) => !child.classList.contains('more')).length;
  }
}
