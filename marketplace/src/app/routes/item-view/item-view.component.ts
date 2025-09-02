import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Component, signal, OnDestroy } from '@angular/core';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { distinctUntilChanged, filter, fromEvent, map, shareReplay, switchMap, Subject, takeUntil, tap } from 'rxjs';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { BreadcrumbsComponent } from '@/routes/item-view/components/breadcrumbs/breadcrumbs.component';
import { AuctionComponent } from '@/components/auctions/auction/auction.component';
import { CommentsComponent } from '@/components/comments/comments.component';

import { ItemStatusComponent } from './components/item-status/item-status.component';
import { ItemActionsComponent } from './components/item-actions/item-actions.component';
import { ItemAttributesComponent } from './components/item-attributes/item-attributes.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TraitRarityPipe } from '@/pipes/trait-rarity.pipe';
import { QueryParamsPipe } from '@/pipes/query-params.pipe';

import { DataService } from '@/services/data.service';

import { GlobalState } from '@/models/global-state';

import * as appStateSelectors from '@/state/app/app-state.selectors';

import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,

    LazyLoadImageModule,

    PhunkBillboardComponent,
    TxHistoryComponent,
    WalletAddressDirective,
    BreadcrumbsComponent,
    CommentsComponent,
    AuctionComponent,
    ItemStatusComponent,
    ItemActionsComponent,
    ItemAttributesComponent,

    TraitRarityPipe,
    QueryParamsPipe,
  ],
  selector: 'app-phunk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})
export class ItemViewComponent {

  explorerUrl = environment.explorerUrl;

  singlePhunk$ = this.route.params.pipe(
    // tap((params: any) => console.log('ItemViewComponent', {params})),
    filter((params: any) => !!params.hashId),
    distinctUntilChanged((prev, curr) => prev.hashId === curr.hashId),
    switchMap((params: any) => this.dataSvc.fetchSinglePhunk(params.hashId)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  scrollY$ = fromEvent(document, 'scroll').pipe(
    map(() => (window.scrollY / 2) * -1),
  );

  config$ = this.store.select(appStateSelectors.selectConfig);
  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  indexerIsBehind$ = this.store.select(appStateSelectors.selectIndexerIsBehind);

  billboardExpanded = signal(false);

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public dataSvc: DataService,
  ) {}

  expandBillboard(): void {
    this.billboardExpanded.update((expanded) => !expanded);
  }
}
