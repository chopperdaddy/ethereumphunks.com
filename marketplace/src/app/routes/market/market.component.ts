import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
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

import { SlideoutComponent } from '@/components/slideout/slideout.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { environment } from 'src/environments/environment';

import { firstValueFrom, map, tap } from 'rxjs';

const defaultActionState = {
  canList: false,
  canTransfer: false,
  canWithdraw: false,
  canEscrow: false,
};

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

    PhunkGridComponent,
    MarketFiltersComponent,
    ModalComponent,
    SlideoutComponent,

    WalletAddressDirective,
    WeiToEthPipe,

    TokenIdParsePipe,
  ],
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss']
})

export class MarketComponent {

  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;

  env = environment;

  escrowAddress = environment.marketAddress;

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

  activeSortModel: any = this.sorts[0];
  filtersVisible: boolean = false;

  selectedPhunksFormArray: FormArray = this.fb.array([]);
  transferAddress = new FormControl<string | null>('');

  selected: { [string: Phunk['hashId']]: Phunk } = {};
  deselected: Phunk[] = [];
  objectKeys = Object.keys;
  selectedValue: string = '';

  selectMutipleActive: boolean = false;
  selectAll: boolean = false;

  isListingBulk: boolean = false;
  isTransferingBulk: boolean = false;

  bulkListingForm = this.fb.group({
    listingPhunks: this.fb.array([])
  });

  actionsState: {
    canList: boolean,
    canTransfer: boolean,
    canWithdraw: boolean,
    canEscrow: boolean,
  } = defaultActionState;

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  marketType$ = this.store.select(appStateSelectors.selectMarketType);
  activeMarketRouteData$ = this.store.select(dataStateSelectors.selectActiveMarketRouteData);
  activeTraitFilters$ = this.store.select(appStateSelectors.selectActiveTraitFilters).pipe(
    map((filters: any) => Object.keys(filters).length),
  );
  activeSort$ = this.store.select(appStateSelectors.selectActiveSort).pipe(
    tap((sort: any) => this.activeSortModel = sort)
  );
  slidseoutActive$ = this.store.select(appStateSelectors.selectSlideoutActive).pipe(
    tap((slideoutActive: boolean) => {
      if (!slideoutActive) {
        this.isListingBulk = false;
        this.isTransferingBulk = false;
        this.selectedPhunksFormArray = this.fb.array([]);
      }
    })
  );

  ceil = Math.ceil;

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public dataSvc: DataService,
    private web3Svc: Web3Service,
    private fb: FormBuilder
  ) {}

  setSort($event: any): void {
    this.store.dispatch(appStateActions.setActiveSort({ activeSort: $event }));
  }

  async batchAction(type: 'transfer' | 'escrow' | 'withdraw' | 'list' | 'sweep'): Promise<void> {
    if (!Object.keys(this.selected).length) return;

    if (type === 'sweep') this.buySelected();
    if (type === 'transfer') await this.transferSelected();
    if (type === 'list') await this.listSelected();
    if (type === 'escrow') await this.batchEscrow();
    if (type === 'withdraw') await this.withdrawBatch();
  }

  // Actions
  async buySelected(): Promise<void> {
    // check wallet balance
    await this.web3Svc.batchBuyPhunks(Object.values(this.selected));
  }

  async transferSelected(): Promise<void> {
    this.isTransferingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, deselected } = await this.getSelectedEscrowed();
    this.deselected = inEscrow;

    const formArray = this.fb.array(deselected.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      listPrice: [''],
    }))) as FormArray;

    this.bulkListingForm.setControl('listingPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkListingForm.get('listingPhunks') as FormArray;

    setTimeout(() => this.transferAddressInput.nativeElement.focus(), 0);
  }

  async listSelected(): Promise<void> {
    this.isListingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, deselected } = await this.getSelectedEscrowed();
    this.deselected = deselected;

    console.log({inEscrow, deselected});

    const formArray = this.fb.array(inEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      listPrice: [''],
    }))) as FormArray;

    this.bulkListingForm.setControl('listingPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkListingForm.get('listingPhunks') as FormArray;
  }

  async batchEscrow(): Promise<void> {
    const selectedHashIds = Object.keys(this.selected);
    const canTransfer = await firstValueFrom(
      this.dataSvc.phunksCanTransfer(selectedHashIds)
    );

    const selected: { [string: Phunk['hashId']]: Phunk } = {};
    canTransfer.forEach((phunk: Phunk) => selected[phunk.hashId] = phunk);
    this.selected = selected;

    const phunkIds = Object.values(selected).map((phunk: Phunk) => phunk.tokenId);
    const hexString = Object.keys(selected).map(hashId => hashId?.substring(2)).join('');

    const hex = `0x${hexString}`;
    if (hex === '0x') return;

    try {
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'sendToEscrow',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
        }
      }));

      const hash = await this.web3Svc.transferPhunk(hex, this.escrowAddress);

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'sendToEscrow',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash,
        }
      }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'sendToEscrow',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash: receipt.transactionHash,
        }
      }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'sendToEscrow',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          detail: err,
        }
      }));
    }
  }

  async withdrawBatch(): Promise<void> {
    const selectedHashIds = Object.keys(this.selected);
    const inEscrow = await firstValueFrom(
      this.dataSvc.phunksAreInEscrow(selectedHashIds)
    );

    const selected: { [string: Phunk['hashId']]: Phunk } = {};
    inEscrow.forEach((phunk: Phunk) => selected[phunk.hashId] = phunk);
    this.selected = selected;

    const phunkIds = Object.values(selected).map((phunk: Phunk) => phunk.tokenId);

    try {
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'withdrawPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
        }
      }));

      const hash = await this.web3Svc.withdrawBatch(Object.keys(selected));

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'withdrawPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash,
        }
      }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'withdrawPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash: receipt.transactionHash,
        }
      }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'withdrawPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          detail: err,
        }
      }));
    }
  }

  // Submissions
  async getSelectedEscrowed(): Promise<{ deselected: Phunk[], inEscrow: Phunk[]}> {
    const selectedHashIds = Object.keys(this.selected);
    const inEscrow = await firstValueFrom(
      this.dataSvc.phunksAreInEscrow(selectedHashIds)
    );

    const deselected = selectedHashIds
      .filter(hashId => !inEscrow.find((phunk: Phunk) => phunk.hashId === hashId))
      .map(hashId => this.selected[hashId]);

    return { deselected, inEscrow };
  }

  async submitBatchTransfer(): Promise<void> {

    if (!this.bulkListingForm.value.listingPhunks) return;
    const hashIds = this.bulkListingForm.value.listingPhunks.map((phunk: any) => phunk.hashId);
    const phunkIds = this.bulkListingForm.value.listingPhunks.map((phunk: any) => phunk.phunkId as number) || [];

    if (!hashIds?.length) return;
    if (!this.transferAddress.value) return;

    try {
      let toAddress: string | null = this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'transferPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
        }
      }));

      this.closeModal();

      const hash = await this.web3Svc.batchTransferPhunks(hashIds, toAddress);

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'transferPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash,
        }
      }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'transferPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash: receipt.transactionHash,
        }
      }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'transferPhunk',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          detail: err,
        }
      }));
    }
  }

  async submitBatchListing(): Promise<void> {

    if (!this.bulkListingForm.value.listingPhunks) return;

    const newListings = this.bulkListingForm.value.listingPhunks
      .filter((phunk: any) => phunk.listPrice);

    if (!newListings.length) return;

    const listings = newListings.map((phunk: any) => ({ hashId: phunk.hashId, listPrice: phunk.listPrice }))|| [];
    const phunkIds = newListings.map((phunk: any) => phunk.phunkId as number) || [];

    try {
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'offerPhunkForSale',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
        }
      }));

      this.closeModal();

      const hash = await this.web3Svc.batchOfferPhunkForSale(
        listings.map(phunk => phunk.hashId),
        listings.map(phunk => phunk.listPrice)
      );

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'offerPhunkForSale',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash,
        }
      }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'offerPhunkForSale',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          hash: receipt.transactionHash,
        }
      }));

      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'offerPhunkForSale',
          phunkId: phunkIds[0],
          phunkIds,
          isBatch: true,
          detail: err,
        }
      }));
    }
  }

  selectedChange($event: any): void {
    this.selectedValue = Object.values(this.selected).reduce(
      (acc: number, phunk: Phunk) => acc += Number(phunk.listing?.minValue || '0'),
    0).toString();

    this.actionsState = {
      canList: false,
      canTransfer: false,
      canWithdraw: false,
      canEscrow: false,
    };

    Object.values(this.selected).forEach((phunk: Phunk) => {
      // console.log({phunk});
      if (phunk.isEscrowed) {
        this.actionsState.canWithdraw = true;
        this.actionsState.canList = true;
      } else {
        this.actionsState.canTransfer = true;
        this.actionsState.canEscrow = true;
      };
    });
    this.actionsState = { ...this.actionsState };
  }

  setSelectMiltiple() {
    this.selectMutipleActive = !this.selectMutipleActive;
    this.selectAll = false;
  }

  clearSelectedAndClose() {
    this.selectMutipleActive = false;
    this.selectAll = false;
    this.selected = {};
    this.actionsState = defaultActionState;
  }

  closeModal(): void {
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: false }));
  }

  copyToNext(index: number) {
    this.selectedPhunksFormArray.controls[index + 1].get('listPrice')?.setValue(
      this.selectedPhunksFormArray.controls[index].get('listPrice')?.value
    );
  }
}
