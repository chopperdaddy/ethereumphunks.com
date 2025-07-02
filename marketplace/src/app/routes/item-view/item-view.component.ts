import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Component, signal } from '@angular/core';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { distinctUntilChanged, filter, fromEvent, map, shareReplay, switchMap } from 'rxjs';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { BreadcrumbsComponent } from '@/components/breadcrumbs/breadcrumbs.component';
import { AuctionComponent } from '@/components/auction/auction.component';
import { CommentsComponent } from '@/components/comments/comments.component';

import { ItemStatusComponent } from './components/item-status/item-status.component';
import { ItemActionsComponent } from './components/item-actions/item-actions.component';
import { ItemAttributesComponent } from './components/item-attributes/item-attributes.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TraitCountPipe } from '@/pipes/trait-count.pipe';
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

    TraitCountPipe,
    QueryParamsPipe,
  ],
  selector: 'app-phunk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})
export class ItemViewComponent {

  explorerUrl = environment.explorerUrl;

  singlePhunk$ = this.route.params.pipe(
    filter((params: any) => !!params.hashId),
    distinctUntilChanged((prev, curr) => prev.hashId === curr.hashId),
    switchMap((params: any) => this.dataSvc.fetchSinglePhunk(params.hashId)),
    shareReplay(1),
  );

  scrollY$ = fromEvent(document, 'scroll').pipe(
    map(() => (window.scrollY / 2) * -1),
  );

  globalConfig$ = this.store.select(appStateSelectors.selectConfig);
  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  indexerIsBehind$ = this.store.select(appStateSelectors.selectBlocksBehind).pipe(
    filter((blocksBehind) => !!blocksBehind),
    map((blocksBehind) => blocksBehind > 4),
  );

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
