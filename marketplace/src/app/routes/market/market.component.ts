import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { NgSelectModule } from '@ng-select/ng-select';

import { MarketHeaderComponent } from './components/market-header.component';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { MarketFiltersComponent } from '@/components/market-filters/market-filters.component';
import { SlideoutComponent } from '@/components/slideout/slideout.component';

import { Sort, Sorts } from '@/models/pipes';

import { GlobalState, Notification, TraitFilter } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { UtilService } from '@/services/util.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import * as appStateSelectors from '@/state/app/app-state.selectors';
import * as appStateActions from '@/state/app/app-state.actions';
import * as dataStateSelectors from '@/state/data/data-state.selectors';
import * as marketStateSelectors from '@/state/market/market-state.selectors';
import * as marketStateActions from '@/state/market/market-state.actions';

import { upsertNotification } from '@/state/notification/notification.actions';

import { environment } from '@environments/environment';

import { filter, map, tap } from 'rxjs';
import { MarketType } from '@/models/market.state';

const defaultActionState = {
  canList: false,
  canTransfer: false,
  canWithdraw: false,
  canEscrow: false,
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    NgxPaginationModule,
    NgSelectModule,
    FormsModule,
    ReactiveFormsModule,

    MarketHeaderComponent,
    PhunkGridComponent,
    MarketFiltersComponent,
    SlideoutComponent,

    WeiToEthPipe,
    CalcPipe,
    FormatCashPipe,
  ],
  selector: 'app-phunk-grid-view',
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss']
})

export class MarketComponent {

  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;

  env = environment;

  escrowAddress = environment.marketAddress;

  sorts = signal<{ label: string, value: Sorts }[]>([
    { label: 'Price Low', value: 'price-low' },
    { label: 'Price High', value: 'price-high' },
    { label: 'Rank High', value: 'rank-high' },
    { label: 'Rank Low', value: 'rank-low' },
    { label: 'Recently Listed', value: 'recently-listed' },
    { label: 'Token ID', value: 'id' },
    // { label: 'Recent', value: 'recent' },
  ]);
  activeSortModel: Sort = this.sorts()[0];
  filtersVisible: boolean = false;

  bulkActionsForm = this.fb.group({
    listingPhunks: this.fb.array([]),
    transferPhunks: this.fb.array([]),
    escrowPhunks: this.fb.array([]),
    withdrawPhunks: this.fb.array([]),
    buyPhunks: this.fb.array([]),
  });

  selectedPhunksFormArray: FormArray = this.fb.array([]);
  transferAddress = new FormControl<string | null>('');

  selected: { [string: Phunk['hashId']]: Phunk } = {};
  deselected: Phunk[] = [];
  selectedValue: string = '';

  selectMultipleActive: boolean = false;
  selectAll: boolean = false;

  isListingBulk: boolean = false;
  isTransferingBulk: boolean = false;
  isEscrowingBulk: boolean = false;
  isWithdrawingBulk: boolean = false;
  isBuyingBulk: boolean = false;

  actionsState: {
    canList: boolean,
    canTransfer: boolean,
    canWithdraw: boolean,
    canEscrow: boolean,
  } = defaultActionState;

  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);
  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);

  routeParamAddress$ = this.route.queryParams.pipe(
    map((params) => params['address'])
  );

  slideoutActive$ = this.store.select(appStateSelectors.selectSlideoutActive).pipe(
    tap((slideoutActive: boolean) => {
      if (!slideoutActive) this.resetState();
    })
  );

  marketType$ = this.store.select(marketStateSelectors.selectMarketType).pipe(
    filter((marketType: MarketType | null) => !!marketType),
    tap((marketType: MarketType) => {
      if (marketType === 'all') {
        this.sorts.set(this.sorts().slice(2));
        this.activeSortModel = this.sorts()[0];
      }
    })
  );
  activeMarketRouteData$ = this.store.select(marketStateSelectors.selectActiveMarketRouteData).pipe(
    // tap((routeData: any) => {
    //   console.log({ routeData });
    // })
  );

  activeTraitFilters$ = this.store.select(marketStateSelectors.selectActiveTraitFilters).pipe(
    map((traitFilters: any) => {
      const traitFiltersCopy = { ...traitFilters };
      delete traitFiltersCopy['address'];
      return traitFiltersCopy as TraitFilter;
    })
  );

  activeSort$ = this.store.select(marketStateSelectors.selectActiveSort).pipe(
    tap((sort: any) => this.activeSortModel = sort)
  );

  indexerIsBehind$ = this.store.select(appStateSelectors.selectIndexerIsBehind);

  advancedMode$ = this.store.select(appStateSelectors.selectAdvancedMode);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  ceil = Math.ceil;
  objectKeys = Object.keys;
  objectValues = Object.values;

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    private utilSvc: UtilService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
  ) {}

  /**
   * Sets the active sort option for the market view
   * @param $event - The sort option selected by the user
   */
  setSort($event: Sort): void {
    this.store.dispatch(marketStateActions.setActiveSort({ activeSort: $event }));
  }

  /**
   * Executes a batch action on selected phunks
   * @param type - The type of batch action to perform (transfer, escrow, withdraw, list, or sweep)
   */
  async batchAction(type: 'transfer' | 'escrow' | 'withdraw' | 'list' | 'sweep'): Promise<void> {
    if (!Object.keys(this.selected).length) return;

    if (type === 'sweep') await this.buySelected();
    if (type === 'transfer') await this.transferSelected();
    if (type === 'escrow') await this.escrowSelected();
    if (type === 'list') await this.listSelected();
    if (type === 'withdraw') await this.withdrawSelected();
  }

  /**
   * Prepares the UI for bulk buying of selected phunks
   * Filters out phunks that are not in escrow or invalid, then sets up the form
   */
  async buySelected(): Promise<void> {
    this.isBuyingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, notInEscrow, invalid } = await this.checkSelected(true);
    this.deselected = [ ...notInEscrow, ...invalid ];

    const formArray = this.fb.array(inEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      sha: [phunk.sha],
      listing: {
        minValue: [phunk.listing?.minValue]
      },
    }))) as FormArray;

    this.bulkActionsForm.setControl('buyPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkActionsForm.get('buyPhunks') as FormArray;
  }

  /**
   * Prepares the UI for bulk transfer of selected phunks
   * Filters out phunks that are in escrow or invalid, then sets up the form and focuses the address input
   */
  async transferSelected(): Promise<void> {
    this.isTransferingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, notInEscrow, invalid } = await this.checkSelected();
    this.deselected = [ ...inEscrow, ...invalid ];

    const formArray = this.fb.array(notInEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      sha: [phunk.sha],
      listPrice: [''],
    }))) as FormArray;

    this.bulkActionsForm.setControl('transferPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkActionsForm.get('transferPhunks') as FormArray;

    setTimeout(() => this.transferAddressInput.nativeElement.focus(), 100);
  }

  /**
   * Prepares the UI for bulk listing of selected phunks
   * Filters out phunks that are not in escrow, then sets up the form
   */
  async listSelected(): Promise<void> {
    this.isListingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, notInEscrow } = await this.checkSelected();
    this.deselected = notInEscrow;

    const formArray = this.fb.array(inEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      sha: [phunk.sha],
      listing: [phunk.listing],
      listPrice: [''],
    }))) as FormArray;

    this.bulkActionsForm.setControl('listingPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkActionsForm.get('listingPhunks') as FormArray;
  }

  /**
   * Prepares the UI for bulk escrow of selected phunks
   * Filters out phunks that are already in escrow or invalid, then sets up the form
   */
  async escrowSelected(): Promise<void> {
    this.isEscrowingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, notInEscrow, invalid } = await this.checkSelected();
    this.deselected = [ ...inEscrow, ...invalid ];

    const formArray = this.fb.array(notInEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      slug: [phunk.slug],
      sha: [phunk.sha],
      listPrice: [''],
    }))) as FormArray;

    this.bulkActionsForm.setControl('escrowPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkActionsForm.get('escrowPhunks') as FormArray;
  }

  /**
   * Prepares the UI for bulk withdrawal of selected phunks
   * Filters out phunks that are not in escrow, then sets up the form
   */
  async withdrawSelected(): Promise<void> {
    this.isWithdrawingBulk = true;
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: true }));

    const { inEscrow, notInEscrow } = await this.checkSelected();
    this.deselected = notInEscrow;

    const formArray = this.fb.array(inEscrow.map((phunk: Phunk) => this.fb.group({
      phunkId: [phunk.tokenId],
      hashId: [phunk.hashId],
      sha: [phunk.sha],
      listing: [phunk.listing],
      listPrice: [''],
    }))) as FormArray;

    this.bulkActionsForm.setControl('withdrawPhunks', formArray);
    this.selectedPhunksFormArray = this.bulkActionsForm.get('withdrawPhunks') as FormArray;
  }

  /**
   * Submits a batch transfer transaction for selected phunks
   * Validates the transfer address and executes the blockchain transaction
   */
  async submitBatchTransfer(): Promise<void> {

    if (!this.bulkActionsForm.value.transferPhunks) return;
    const hashIds = this.bulkActionsForm.value.transferPhunks.map((phunk: any) => phunk.hashId);

    if (!hashIds?.length) return;
    if (!this.transferAddress.value) return;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('transferPhunk' + hashIds.map((hashId: string) => hashId.substring(2)).join('')),
      timestamp: Date.now(),
      type: 'wallet',
      function: 'transferPhunk',
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    };

    this.store.dispatch(upsertNotification({ notification }));
    this.closeSlideout();

    try {
      let toAddress: string | null = this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      const hash = await this.web3Svc.batchTransferPhunks(hashIds, toAddress);
      if (!hash) throw new Error('Transaction failed');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /**
   * Submits a batch listing transaction for selected phunks
   * Validates listing prices and executes the blockchain transaction
   */
  async submitBatchListing(): Promise<void> {
    if (!this.bulkActionsForm.value.listingPhunks) return;

    const newListings = this.bulkActionsForm.value.listingPhunks
      .filter((phunk: any) => phunk.listPrice);

    if (!newListings.length) return;

    const listings = newListings.map((phunk: any) => ({ hashId: phunk.hashId, listPrice: phunk.listPrice }))|| [];
    const hashIds = newListings.map((phunk: any) => phunk.hashId) || [];

    if (!hashIds?.length) return;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('offerPhunkForSale' + hashIds.map((hashId: string) => hashId.substring(2)).join('')),
      timestamp: Date.now(),
      type: 'wallet',
      function: 'offerPhunkForSale',
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    };

    this.store.dispatch(upsertNotification({ notification }));
    this.closeSlideout();

    try {
      const hash = await this.web3Svc.batchOfferPhunkForSale(
        listings.map(phunk => phunk.hashId),
        listings.map(phunk => phunk.listPrice)
      );
      if (!hash) throw new Error('Transaction failed');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /**
   * Submits a batch escrow transaction for selected phunks
   * Transfers phunks to the escrow contract address
   */
  async submitBatchEscrow(): Promise<void> {
    if (!this.bulkActionsForm.value.escrowPhunks) return;

    const { notInEscrow } = await this.checkSelected();

    const selected: { [string: Phunk['hashId']]: Phunk } = {};
    notInEscrow.forEach((phunk: Phunk) => selected[phunk.hashId] = phunk);
    this.selected = selected;

    const hashIds = Object.values(selected).map((phunk: Phunk) => phunk.hashId);
    const hexString = Object.keys(selected).map(hashId => hashId?.substring(2)).join('');

    const hex = `0x${hexString}`;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('sendToEscrow' + hashIds.map((hashId: string) => hashId.substring(2)).join('')),
      timestamp: Date.now(),
      type: 'wallet',
      function: 'sendToEscrow',
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    }

    this.store.dispatch(upsertNotification({ notification }));
    this.closeSlideout();

    try {
      if (!hashIds?.length || hex === '0x') throw new Error('Invalid selection');

      const hash = await this.web3Svc.transferPhunk(hex, this.escrowAddress);
      if (!hash) throw new Error('Transaction failed');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /**
   * Submits a batch withdrawal transaction for selected phunks
   * Withdraws phunks from the escrow contract back to the user's wallet
   */
  async submitBatchWithdraw(): Promise<void> {
    if (!this.bulkActionsForm.value.withdrawPhunks) return;

    const { inEscrow } = await this.checkSelected();

    const selected: { [string: Phunk['hashId']]: Phunk } = {};
    inEscrow.forEach((phunk: Phunk) => selected[phunk.hashId] = phunk);
    this.selected = selected;

    const hashIds = Object.values(selected).map((phunk: Phunk) => phunk.hashId);

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('withdrawPhunk' + hashIds.map((hashId: string) => hashId.substring(2)).join('')),
      timestamp: Date.now(),
      type: 'wallet',
      function: 'withdrawPhunk',
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    };

    this.store.dispatch(upsertNotification({ notification }));
    this.closeSlideout();

    try {
      if (!hashIds?.length) throw new Error('Invalid selection');

      const hash = await this.web3Svc.withdrawBatch(Object.keys(selected));
      if (!hash) throw new Error('Transaction failed');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /**
   * Submits a batch buy transaction for selected phunks
   * Purchases multiple phunks that are currently listed for sale
   */
  async submitBatchBuy(): Promise<void> {
    if (!this.bulkActionsForm.value.buyPhunks) return;

    const { inEscrow } = await this.checkSelected(true);

    const selected: { [string: Phunk['hashId']]: Phunk } = {};
    inEscrow.forEach((phunk: Phunk) => selected[phunk.hashId] = phunk);
    this.selected = selected;

    const hashIds = Object.keys(selected);

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('buyPhunk' + hashIds.map((hashId: string) => hashId.substring(2)).join('')),
      timestamp: Date.now(),
      type: 'wallet',
      function: 'buyPhunk',
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    };

    this.store.dispatch(upsertNotification({ notification }));
    this.closeSlideout();

    try {
      if (!hashIds?.length) throw new Error('One or more items are no longer for sale.');

      const hash = await this.web3Svc.batchBuyPhunks(Object.values(selected));
      if (!hash) throw new Error('Transaction failed');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));
      this.clearSelectedAndClose();
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /**
   * Handles changes to the selected phunks collection
   * Updates the total value and available actions based on the current selection
   * @param $event - The selection change event
   */
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

  /**
   * Toggles the multiple selection mode on/off
   * Clears any existing selections when disabling multiple selection
   */
  setSelectActive() {
    this.selectMultipleActive = !this.selectMultipleActive;
    this.selectAll = false;
    if (!this.selectMultipleActive) {
      this.selected = {};
      this.deselected = [];
    }
    this.filtersVisible = false;
  }

  /**
   * Clears all selected items and closes the selection mode
   * Resets the actions state to default values
   */
  clearSelectedAndClose() {
    this.selectMultipleActive = false;
    this.selectAll = false;
    this.selected = {};
    this.actionsState = defaultActionState;
  }

  /**
   * Closes the slideout panel by dispatching the appropriate action
   */
  closeSlideout(): void {
    this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: false }));
  }

  /**
   * Copies the list price from one form control to the next
   * @param index - The index of the current form control
   */
  copyToNext(index: number) {
    this.selectedPhunksFormArray.controls[index + 1].get('listPrice')?.setValue(
      this.selectedPhunksFormArray.controls[index].get('listPrice')?.value
    );
  }

  /**
   * Resets all bulk action states and form arrays
   * Called when the slideout is closed or actions are completed
   */
  resetState() {
    this.isListingBulk = false;
    this.isTransferingBulk = false;
    this.isEscrowingBulk = false;
    this.isWithdrawingBulk = false;
    this.isBuyingBulk = false;
    this.selectedPhunksFormArray = this.fb.array([]);
  }

  /**
   * Validates and categorizes selected phunks based on their escrow status and ownership
   * @param removeOwnedItems - Whether to filter out items owned by the current user
   * @returns Object containing arrays of phunks categorized by their status
   */
  async checkSelected(
    removeOwnedItems = false
  ): Promise<{ notInEscrow: Phunk[], inEscrow: Phunk[], invalid: Phunk[]}> {

    let selected = Object.values(this.selected);
    let invalid: Phunk[] = [];

    if (removeOwnedItems) {
      [ selected, invalid ] = await this.filterOwnedItems(selected);
    }

    [ selected, invalid ] = await this.filterLockedItems(selected);

    selected = await this.dataSvc.checkConsensus(Object.values(selected));

    const consensusInvalid = selected.filter((phunk: Phunk) => phunk.consensus === false);
    invalid = [...invalid, ...consensusInvalid];

    const inEscrow = selected.filter(
      (phunk: Phunk) => phunk.owner.toLowerCase() === environment.marketAddress.toLowerCase()
    );

    const notInEscrow = selected.filter(
      (phunk: Phunk) => phunk.owner.toLowerCase() !== environment.marketAddress.toLowerCase()
    );

    // console.log({ notInEscrow, inEscrow, invalid });
    return { notInEscrow, inEscrow, invalid };
  }

  /**
   * Filters out phunks that are bridged/locked and cannot be traded
   * @param phunks - Array of phunks to filter
   * @returns Tuple containing valid and invalid phunks
   */
  async filterLockedItems(phunks: Phunk[]): Promise<[Phunk[], Phunk[]]> {
    let validItems: Phunk[] = [];
    let invalidItems: Phunk[] = [];

    validItems = phunks.filter(phunk => !phunk.isBridged);
    invalidItems = phunks.filter(phunk => phunk.isBridged);
    return [validItems, invalidItems];
  }

  /**
   * Filters out phunks that are owned by the current user
   * @param phunks - Array of phunks to filter
   * @returns Tuple containing valid and invalid phunks
   */
  async filterOwnedItems(phunks: Phunk[]): Promise<[Phunk[], Phunk[]]> {
    const walletAddress = (await this.web3Svc.getCurrentAddress())?.toLowerCase();
    const marketAddress = environment.marketAddress.toLowerCase();
    let validItems: Phunk[] = [];
    let invalidItems: Phunk[] = [];

    phunks.forEach(phunk => {
      const owner = phunk.owner.toLowerCase();
      if (
        (owner === marketAddress && phunk.prevOwner === walletAddress) ||
        owner === walletAddress
      ) {
        invalidItems.push(phunk);
      } else {
        validItems.push(phunk);
      }
    });

    return [validItems, invalidItems];
  }

  /**
   * Toggles the visibility of the filters panel
   * Disables multiple selection mode when showing filters
   */
  toggleFilters() {
    this.filtersVisible = !this.filtersVisible;
    this.selectMultipleActive = false;
  }
}
