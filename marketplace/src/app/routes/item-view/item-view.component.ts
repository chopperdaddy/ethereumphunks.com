import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { StateService } from '@/services/state.service';
import { ThemeService } from '@/services/theme.service';

import { Phunk } from '@/models/graph';
import { GlobalState } from '@/models/global-state';

import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, Subject, fromEvent, merge } from 'rxjs';
import { TransactionReceipt } from 'viem';

import { environment } from 'src/environments/environment';

import * as actions from '@/state/actions/app-state.action';
import * as selectors from '@/state/selectors/app-state.selector';
import { ModalComponent } from '@/components/modal/modal.component';
import { BreadcrumbsComponent } from '@/components/breadcrumbs/breadcrumbs.component';

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
    ModalComponent,
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

  @ViewChild('modal') modal!: ElementRef;

  explorerUrl = `https://${environment.chainId === 5 ? 'goerli.' : ''}etherscan.io`;
  escrowAddress = environment.phunksMarketAddress;

  txModalActive: boolean = false;

  sellModalActive: boolean = false;
  listPrice = new FormControl<number>(0);
  listToAddress = new FormControl<string | null>('');

  bidModalActive: boolean = false;
  bidPrice = new FormControl<number>(0);

  transferModalActive: boolean = false;
  transferAddress = new FormControl<string | null>('');

  acceptBidModalActive: boolean = false;
  // transferAddress = new FormControl<string | null>('');

  txStatus: TxStatuses = {
    pending: {
      title: 'Transaction Pending',
      message: null,
      active: false
    },
    submitted: {
      title: 'Transaction Submitted',
      message: null,
      active: false
    },
    escrow: {
      title: 'Transaction Submitted',
      message: null,
      active: false
    },
    complete: {
      title: 'Transaction Complete',
      message: null,
      active: false
    },
    error: {
      title: 'Transaction Error',
      message: null,
      active: false
    }
  };

  errorMessage!: any;
  transactionError: boolean = false;

  objectValues = Object.values;

  refreshPhunk$ = new Subject<void>();

  walletAddress$ = this.store.select(selectors.selectWalletAddress);
  singlePhunk$ = this.store.select(selectors.selectSinglePhunk);

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public stateSvc: StateService,
    public themeSvc: ThemeService,
  ) {
    this.route.params.pipe(
      tap((params: any) => this.store.dispatch(actions.fetchSinglePhunk({ phunkId: params.tokenId }))),
    ).subscribe();
    this.listPrice.setValue(this.dataSvc.getFloor());
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.store.dispatch(actions.clearSinglePhunk());
    this.destroy$.next();
    this.destroy$.complete();
  }

  sellPhunk(): void {
    this.sellModalActive = true;
  }

  transferPhunk(): void {
    this.transferModalActive = true;
  }

  bidOnPhunk(): void {
    this.bidModalActive = true;
  }

  acceptBid(): void {
    this.acceptBidModalActive = true;
  }

  initTransactionMessage(message?: string): void {
    this.txModalActive = true;
    this.clearTransaction();

    this.txStatus.pending.active = true;
    this.txStatus.pending.message = message || '<p>Please submit your transaction using the connected Ethereum wallet.</p>';

    this.txStatus = { ...this.txStatus };
  }

  setTransactionMessage(hash: string, message?: string): void {
    this.txModalActive = true;
    this.clearTransaction();

    this.txStatus.submitted.active = true;

    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-6)}`;
    this.txStatus.submitted.message = (message || `
      <p>Your transaction is being processed on the Ethereum network.</p>
      <p>Transaction hash: <a href="${this.explorerUrl}/tx/${hash}" target="_blank">${shortHash}</a></p>
      <p>View it <a href="${this.explorerUrl}/tx/${hash}" target="_blank">here</a></p>
    `).replace(/\s+/g, ' ');

    this.txStatus = { ...this.txStatus };
  }

  setTransactionCompleteMessage(receipt: any, message?: string): void {
    // console.log('receipt', receipt);

    this.txModalActive = true;
    this.clearTransaction();

    this.txStatus.complete.active = true;

    const hash = receipt.transactionHash;
    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-6)}`;
    this.txStatus.complete.message = message || `
      <p>Your transaction is complete.</p>
      <p>Transaction hash: <a href="${this.explorerUrl}/tx/${hash}" target="_blank">${shortHash}</a></p>
      <p>View it <a href="${this.explorerUrl}/tx/${hash}" target="_blank">here</a></p>
    `.replace(/\s+/g, ' ');

    this.txStatus = { ...this.txStatus };
  }

  setErrorTransactionMessage(err: any, message?: string): void {

    this.closeAll();
    this.clearTransaction();

    this.txModalActive = true;

    console.log({err});

    this.txStatus.error.active = true;

    const details = err.details || err.message;
    this.txStatus.error.message = message || `
      <p>There was an error with your transaction:</p>
      <p class="error">${details}</p>
    `.replace(/\s+/g, ' ');

    this.txStatus = { ...this.txStatus };
  }

  closeTxModal(): void {
    this.txModalActive = false;
    this.clearTransaction();
  }

  clearTransaction(): void {
    for (const status of Object.keys(this.txStatus)) {
      this.txStatus[status as keyof TxStatuses].active = false;
      this.txStatus[status as keyof TxStatuses].message = null;
    }
    this.txStatus = { ...this.txStatus };
  }

  closeAcceptBid(): void {
    this.acceptBidModalActive = false;
  }

  closeListing(): void {
    this.sellModalActive = false;
    this.listPrice.setValue(this.dataSvc.getFloor());
  }

  closeTransfer(): void {
    this.transferModalActive = false;
    this.transferAddress.setValue('');
  }

  closeBid(): void {
    this.bidModalActive = false;
    this.bidPrice.setValue(0);
  }

  closeAll(): void {
    console.log('closeAll');
    this.closeTxModal();
    this.closeAcceptBid();
    this.closeListing();
    this.closeTransfer();
    this.closeBid();
  }

  async submitListing(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      if (!this.listPrice.value) return;

      const tokenId = phunk.hashId;
      const value = this.listPrice.value;
      let address = this.listToAddress.value;

      const isInEscrow = await this.web3Svc.isInEscrow(tokenId);
      if (!isInEscrow) {

        this.closeListing();
        this.initTransactionMessage();

        const escrowHash = await this.web3Svc.sendEthscriptionToContract(tokenId);
        this.setTransactionMessage(escrowHash!);

        const escrowReceipt = await this.pollReceipt(escrowHash!);
        this.setTransactionCompleteMessage(escrowReceipt);
      }

      if (address) {
        if (address?.endsWith('.eth')) {
          const ensOwner = await this.web3Svc.getEnsOwner(address);
          if (!ensOwner) throw new Error('ENS name not registered');
          address = ensOwner;
        }
        const validAddress = this.web3Svc.verifyAddress(address);
        if (!validAddress) throw new Error('Invalid address');
      }

      this.closeListing();
      this.initTransactionMessage();

      const hash = await this.web3Svc.offerPhunkForSale(tokenId, value, address);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async sendToEscrow(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      this.initTransactionMessage();
      const tokenId = phunk.hashId;
      const hash = await this.web3Svc.transferPhunk(tokenId, this.escrowAddress);
      this.setEscrowMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  setEscrowMessage(hash: string, message?: string): void {
    this.txStatus.escrow.active = true;

    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-6)}`;
    this.txStatus.submitted.message = (message || `
      <p>Your transaction is being processed on the Ethereum network.</p>
      <p>Transaction hash: <a href="${this.explorerUrl}/tx/${hash}" target="_blank">${shortHash}</a></p>
      <p>View it <a href="${this.explorerUrl}/tx/${hash}" target="_blank">here</a></p>
    `).replace(/\s+/g, ' ');

    this.txStatus = { ...this.txStatus };
  }

  async phunkNoLongerForSale(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      const tokenId = phunk.hashId;

      this.initTransactionMessage();

      const hash = await this.web3Svc.phunkNoLongerForSale(tokenId);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async withdrawBidForPhunk(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;

      this.initTransactionMessage();

      const hash = await this.web3Svc.withdrawBidForPhunk(tokenId);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async acceptBidForPhunk(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;
      const value = phunk.bid?.value;

      this.closeAcceptBid();
      this.initTransactionMessage();

      const hash = await this.web3Svc.acceptBidForPhunk(tokenId, value!);
      const shortHash = `${hash?.slice(0, 6)}...${hash?.slice(-6)}`;

      this.setTransactionMessage(
        hash!,
        `<p>Your transaction was sent to the Flashbots builder and is waitng to be processed.</p>
        <p>Transaction hash: <a href="${this.explorerUrl}/tx/${hash}" target="_blank">${shortHash}</a></p>
        <p>You can <a href="${this.explorerUrl}/tx/${hash}" target="_blank">view it here</a> once complete.</p>
      `);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
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

  async buyPhunk(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;
      const value = phunk.listing?.minValue;

      this.initTransactionMessage();

      const hash = await this.web3Svc.buyPhunk(tokenId, value!);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async submitBid(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');
      if (!this.bidPrice.value) return;

      const tokenId = phunk.hashId;
      const value = this.bidPrice.value;

      this.closeBid();
      this.initTransactionMessage();

      const hash = await this.web3Svc.enterBidForPhunk(tokenId, value);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async submitTransfer(data: Phunk, address?: string): Promise<void> {
    console.log('submitTransfer', data);
    try {

      const hashId = data.hashId;
      if (!hashId) throw new Error('Invalid hashId');

      let toAddress: string | null = address || this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      this.closeTransfer();
      this.initTransactionMessage();

      const hash = await this.web3Svc.transferPhunk(hashId, toAddress);
      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      this.closeAll();
      this.setErrorTransactionMessage(err);
    }
  }

  async withdrawPhunk(phunk: Phunk): Promise<void> {
    try {
      if (!phunk.hashId) throw new Error('Invalid hashId');

      const tokenId = phunk.hashId;

      this.initTransactionMessage();

      const hash = await this.web3Svc.withdrawPhunk(tokenId);
      if (!hash) throw new Error('Could not proccess transaction');

      this.setTransactionMessage(hash!);

      const receipt = await this.pollReceipt(hash!);
      this.setTransactionCompleteMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async addFlashbotsNetwork(): Promise<void> {
    try {
      return await this.web3Svc.addFlashbotsNetwork();
    } catch (err) {
      console.log(err);
    }
  }

  getItemQueryParams(item: any): any {
    return { [item.k.replace(/ /g, '-').toLowerCase()]: item.v.replace(/ /g, '-').toLowerCase() };
  }
}
