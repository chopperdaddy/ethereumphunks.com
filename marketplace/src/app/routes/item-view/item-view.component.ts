import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { PhunkImageComponent } from '@/components/shared/phunk-image/phunk-image.component';
import { BreadcrumbsComponent } from '@/components/breadcrumbs/breadcrumbs.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';

import { Phunk } from '@/models/db';
import { GlobalState } from '@/models/global-state';

import { Subject, filter, map, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';
import { TransactionReceipt } from 'viem';

import { environment } from 'src/environments/environment';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

interface TxStatus {
  title: string;
  message: string | null;
  active: boolean;
}

interface TxStatuses {
  pending: TxStatus;
  submitted: TxStatus;
  escrow: TxStatus;
  complete: TxStatus;
  error: TxStatus;
}

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
    PhunkImageComponent,
    BreadcrumbsComponent,

    TokenIdParsePipe,
    TraitCountPipe,
    WeiToEthPipe,
    FormatCashPipe
  ],
  selector: 'app-phunk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})

export class ItemViewComponent implements AfterViewInit, OnDestroy {

  @ViewChild('bidPriceInput') bidPriceInput!: ElementRef<HTMLInputElement>;
  @ViewChild('sellPriceInput') sellPriceInput!: ElementRef<HTMLInputElement>;
  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;

  explorerUrl = `https://${environment.chainId === 5 ? 'goerli.' : ''}etherscan.io`;
  escrowAddress = environment.phunksMarketAddress;

  sellActive: boolean = false;
  listPrice = new FormControl<number>(0);
  listToAddress = new FormControl<string | null>('');

  bidActive: boolean = false;
  bidPrice = new FormControl<number>(0);

  transferActive: boolean = false;
  transferAddress = new FormControl<string | null>('');

  acceptbidActive: boolean = false;
  // transferAddress = new FormControl<string | null>('');

  objectValues = Object.values;

  refreshPhunk$ = new Subject<void>();

  isCooling$ = this.store.select(appStateSelectors.selectCooldowns).pipe(
    filter((cooldowns) => !!cooldowns),
    switchMap((cooldowns) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => cooldowns.filter((cooldown) => cooldown?.phunkId === phunk?.phunkId)?.length > 0),
    )),
  );

  hasPendingTx$ = this.store.select(appStateSelectors.selectTransactions).pipe(
    filter((transactions) => !!transactions),
    switchMap((transactions) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => transactions.filter((tx) => tx?.phunkId === phunk?.phunkId && tx.type === 'pending')?.length > 0),
    )),
  );

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  singlePhunk$ = this.store.select(dataStateSelectors.selectSinglePhunk);
  theme$ = this.store.select(appStateSelectors.selectTheme);

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
  ) {}

  ngAfterViewInit(): void {
    this.route.params.pipe(
      tap((params: any) => this.store.dispatch(dataStateActions.fetchSinglePhunk({ phunkId: params.tokenId }))),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.store.dispatch(dataStateActions.clearSinglePhunk());
    this.destroy$.next();
    this.destroy$.complete();
  }

  sellPhunk(): void {
    this.closeAll();
    this.sellActive = true;
    setTimeout(() => this.sellPriceInput?.nativeElement.focus(), 0);
  }

  transferPhunkAction(): void {
    this.closeAll();
    this.transferActive = true;
    setTimeout(() => this.transferAddressInput?.nativeElement.focus(), 0);
  }

  bidOnPhunk(): void {
    this.closeAll();
    this.bidActive = true;
    setTimeout(() => this.bidPriceInput?.nativeElement.focus(), 0);
  }

  acceptBid(): void {
    // this.closeAll();
    // this.acceptbidActive = true;
  }

  closeAcceptBid(): void {
    this.acceptbidActive = false;
  }

  closeListing(): void {
    this.sellActive = false;
    this.listPrice.setValue(0);
  }

  closeTransfer(): void {
    this.transferActive = false;
    this.transferAddress.setValue('');
  }

  closeBid(): void {
    this.bidActive = false;
    this.bidPrice.setValue(0);
  }

  closeAll(): void {
    this.closeAcceptBid();
    this.closeListing();
    this.closeTransfer();
    this.closeBid();
  }

  async submitListing(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      if (!this.listPrice.value) return;

      const tokenId = phunk.hashId;
      const value = this.listPrice.value;
      let address = this.listToAddress.value;

      if (address) {
        if (address?.endsWith('.eth')) {
          const ensOwner = await this.web3Svc.getEnsOwner(address);
          if (!ensOwner) throw new Error('ENS name not registered');
          address = ensOwner;
        }
        const validAddress = this.web3Svc.verifyAddress(address);
        if (!validAddress) throw new Error('Invalid address');
      }

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'offerPhunkForSale',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.offerPhunkForSale(tokenId, value, address);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'offerPhunkForSale',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'offerPhunkForSale',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.listPrice.setValue(0);

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'offerPhunkForSale',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async sendToEscrow(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'sendToEscrow',
          phunkId,
        }
      }));

      const tokenId = phunk.hashId;
      const hash = await this.web3Svc.sendEthscriptionToContract(tokenId);
      // this.setEscrowMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'sendToEscrow',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'sendToEscrow',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'sendToEscrow',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async phunkNoLongerForSale(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      const tokenId = phunk.hashId;

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'phunkNoLongerForSale',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.phunkNoLongerForSale(tokenId);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'phunkNoLongerForSale',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'phunkNoLongerForSale',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'phunkNoLongerForSale',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async withdrawBidForPhunk(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'withdrawBidForPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.withdrawBidForPhunk(tokenId);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'withdrawBidForPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'withdrawBidForPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'withdrawBidForPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async acceptBidForPhunk(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;
      const value = phunk.bid?.value;

      this.closeAcceptBid();
      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'acceptBidForPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.acceptBidForPhunk(tokenId, value!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'acceptBidForPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'acceptBidForPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'acceptBidForPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async buyPhunk(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;
      const value = phunk.listing?.minValue;

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'buyPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.buyPhunk(tokenId, value!);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'buyPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'buyPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'buyPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async submitBid(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      if (!this.bidPrice.value) return;

      const tokenId = phunk.hashId;
      const value = this.bidPrice.value;

      // this.closeBid();
      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'enterBidForPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.enterBidForPhunk(tokenId, value);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'enterBidForPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'enterBidForPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'enterBidForPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async transferPhunk(data: Phunk, address?: string): Promise<void> {
    const phunkId = data.phunkId;

    try {

      const hashId = data.hashId;
      if (!hashId) throw new Error('Invalid hashId');

      let toAddress: string | null = address || this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      this.closeTransfer();
      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'transferPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.transferPhunk(hashId, toAddress);
      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'transferPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'transferPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      // this.setErrorTransactionMessage(err);
      console.log(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'transferPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  async withdrawPhunk(phunk: Phunk): Promise<void> {
    const phunkId = phunk.phunkId;

    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;

      // this.initTransactionMessage();
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'wallet',
          function: 'withdrawPhunk',
          phunkId,
        }
      }));

      const hash = await this.web3Svc.withdrawPhunk(tokenId);
      if (!hash) throw new Error('Could not proccess transaction');

      // this.setTransactionMessage(hash!);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'pending',
          function: 'withdrawPhunk',
          phunkId,
          hash,
        }
      }));

      const receipt = await this.pollReceipt(hash!);
      // this.setTransactionCompleteMessage(receipt);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'complete',
          function: 'withdrawPhunk',
          phunkId,
          hash: receipt.transactionHash,
        }
      }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { phunkId, startBlock: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      // this.setErrorTransactionMessage(err);
      this.store.dispatch(appStateActions.upsertTransaction({
        transaction: {
          id: Date.now(),
          type: 'error',
          function: 'withdrawPhunk',
          phunkId,
          detail: err,
        }
      }));
    }
  }

  pollReceipt(hash: string): Promise<TransactionReceipt> {
    let resolved = false;
    return new Promise(async (resolve, reject) => {
      while (!resolved) {
        console.log('polling');
        try {
          const receipt = await this.web3Svc.waitForTransaction(hash);
          if (receipt) {
            resolved = true;
            resolve(receipt);
          }
        } catch (err) {
          console.log(err);
        }
      }
    });
  }

  getItemQueryParams(item: any): any {
    return { [item.k.replace(/ /g, '-').toLowerCase()]: item.v.replace(/ /g, '-').toLowerCase() };
  }
}
