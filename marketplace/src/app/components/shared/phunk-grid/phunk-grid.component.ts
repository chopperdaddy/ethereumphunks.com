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

import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
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

  @Input() phunkData!: Phunk[];
  @Input() viewType: ViewType = 'market';
  @Input() limit!: number;
  @Input() showLabels: boolean = true;
  @Input() observe: boolean = false;
  @Input() traitFilters!: TraitFilter;

  @Input() selectable: boolean = false;
  @Input() selectAll: boolean = false;

  @Output() selectedChange = new EventEmitter<{ [string: Phunk['hashId']]: Phunk }>();
  @Input() selected: { [string: Phunk['hashId']]: Phunk } = {};

  limitArr = Array.from({length: this.limit}, (_, i) => i);

  usd$ = this.store.select(dataStateSelectors.selectUsd);

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

    // $event.forEach((entry) => {
    //   if (entry.isIntersecting) {
    //     const target = entry.target as HTMLElement;
    //     const index = Number(target.dataset.index);

    //     // console.log({ index, limit: this.limit, length: this.phunkData?.length, el: this.el.nativeElement.children });

    //     if (
    //       index >= this.limit - 18 ||
    //       this.el.nativeElement.children.length < this.limit
    //     ) {
    //       this.limit += 50;

    //       if (!this.phunkData) return;
    //       if (this.limit < this.phunkData.length) return;
    //       this.store.dispatch(marketStateActions.paginateAll({ limit: this.limit }));
    //     }
    //   }
    // });
  }
}
