import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';
import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { NgSelectModule } from '@ng-select/ng-select';

import { PhunkGridComponent } from '@/components/shared/phunk-grid/phunk-grid.component';
import { MarketFiltersComponent } from '@/components/market-filters/market-filters.component';
import { ModalComponent } from '@/components/shared/modal/modal.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { Sorts } from '@/models/pipes';
import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';

import { environment } from 'src/environments/environment';

import { BehaviorSubject, Subject, debounce, debounceTime, firstValueFrom, from, map, switchMap, tap, withLatestFrom } from 'rxjs';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

@Component({
  selector: 'app-phunk-grid-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    NgxPaginationModule,
    NgSelectModule,
    FormsModule,
    ReactiveFormsModule,
    IntersectionObserverModule,

    PhunkGridComponent,
    MarketFiltersComponent,
    ModalComponent,

    WalletAddressDirective,

    TokenIdParsePipe,
  ],
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss']
})

export class MarketComponent {

  env = environment;

  escrowAddress = environment.phunksMarketAddress;

  marketTitles: any = {
    all: 'All EtherPhunks',
    listings: 'EtherPhunks for Sale',
    bids: 'Current Bids',
    owned: 'EtherPhunks Owned'
  };

  sorts: { label: string, value: Sorts }[] = [
    { label: 'Price Low', value: 'price-low' },
    { label: 'Price High', value: 'price-high' },
    { label: 'Recent', value: 'recent' },
    { label: 'Token ID', value: 'id' }
  ];

  private activeSort = new BehaviorSubject(this.sorts[0]);
  activeSort$ = this.activeSort.asObservable();
  activeSortModel: any = this.sorts[0];

  // selectedChange$ = new Subject<string[]>();

  currentPage: number = 1;
  filtersVisible: boolean = false;

  transferModalActive: boolean = false;

  selectMutipleActive: boolean = false;
  selectAll: boolean = false;
  isListingBulk: boolean = false;
  selectedHashIds: Phunk['hashId'][] = [];

  txType!: 'Transferring' | 'Withdrawing';
  validSelectedPhunks: Phunk[] = [];

  bulkListingForm = this.fb.group({
    listingPhunks: this.fb.array([])
  });

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  marketType$ = this.store.select(appStateSelectors.selectMarketType);
  activeMarketRouteData$ = this.store.select(dataStateSelectors.selectActiveMarketRouteData);

  selectedPhunksFormArray!: FormArray;

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public dataSvc: DataService,
    private web3Svc: Web3Service,
    private fb: FormBuilder
  ) {}

  setSort($event: any): void {
    this.activeSort.next({ ...$event });
  }

  pageChanged($event: any) {
    this.currentPage = $event;
  }

  setSelectMiltiple() {
    this.selectMutipleActive = !this.selectMutipleActive;
    this.selectAll = false;
  }

  clearSelectedAndClose() {
    this.selectAll = false;
    this.selectedHashIds = [];
  }

  async batchAction(type: 'transfer' | 'escrow' | 'withdraw' | 'list'): Promise<void> {
    if (!this.selectedHashIds.length) return;

    this.transferModalActive = true;

    if (type === 'list') await this.listSelected();
    if (type === 'escrow') await this.batchTransfer(this.escrowAddress);
    if (type === 'withdraw') await this.withdrawBatch();
  }

  async batchTransfer(toAddress: string): Promise<string | undefined> {

    const canTransfer = await firstValueFrom(
      this.dataSvc.phunksCanTransfer(this.selectedHashIds)
    );

    this.validSelectedPhunks = [ ...canTransfer ];
    this.txType = 'Transferring';

    const selected = [ ...canTransfer.map((phunk: Phunk) => phunk.hashId) ];
    this.selectedHashIds = selected;

    const hexString = selected.map(hashId => hashId?.substring(2)).join('');
    const hex = `0x${hexString}`;

    return await this.web3Svc.transferPhunk(hex, toAddress);
  }

  async withdrawBatch(): Promise<string | undefined> {
    const inEscrow = await firstValueFrom(
      this.dataSvc.phunksAreInEscrow(this.selectedHashIds)
    );

    this.validSelectedPhunks = [ ...inEscrow ];
    this.txType = 'Withdrawing';

    const selected = [ ...inEscrow.map((phunk: Phunk) => phunk.hashId) ];
    this.selectedHashIds = selected;

    return await this.web3Svc.withdrawBatch(selected);
  }

  async createPhunksFormArray(): Promise<FormArray> {
    const inEscrow = await firstValueFrom(
      this.dataSvc.phunksAreInEscrow(this.selectedHashIds)
    );

    this.validSelectedPhunks = [ ...inEscrow ];

    const selected = [ ...inEscrow.map((phunk: Phunk) => phunk.hashId) ];
    this.selectedHashIds = selected;

    return this.fb.array(inEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.phunkId],
      hashId: [phunk.hashId],
      listPrice: [''],
    })));
  }

  closeModal(): void {
    this.transferModalActive = false;
  }

  async listSelected(): Promise<void> {
    this.isListingBulk = true;
    const formArray = await this.createPhunksFormArray();
    this.bulkListingForm.setControl('listingPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkListingForm.get('listingPhunks') as FormArray;
  }

  async submitBatchListing(): Promise<void> {
    const hashIds = this.bulkListingForm.value.listingPhunks?.map((phunk: any) => phunk.hashId);
    const listPrices = this.bulkListingForm.value.listingPhunks?.map((phunk: any) => phunk.listPrice);
    if (!hashIds || !listPrices) return;
    this.web3Svc.batchOfferPhunkForSale(hashIds, listPrices);
  }
}
