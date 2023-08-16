import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PunkBillboardComponent } from './components/punk-billboard/punk-billboard.component';
import { TxHistoryComponent } from '@/routes/item-view/components/tx-history/tx-history.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { StateService } from '@/services/state.service';
import { ThemeService } from '@/services/theme.service';

import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { BehaviorSubject, Subject, firstValueFrom, fromEvent, merge, of } from 'rxjs';

import { Punk } from '@/models/graph';
import { HttpClient } from '@angular/common/http';
import { TransactionReceipt } from 'viem';

interface TxStatus {
  title: string;
  message: string | null;
  active: boolean;
}

interface TxStatuses {
  pending: TxStatus;
  submitted: TxStatus;
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

    PunkBillboardComponent,
    TxHistoryComponent,
    WalletAddressDirective,

    TokenIdParsePipe,
    TraitCountPipe,
    WeiToEthPipe,
    FormatCashPipe
  ],
  selector: 'app-punk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})

export class ItemViewComponent implements AfterViewInit, OnDestroy {

  @ViewChild('modal') modal!: ElementRef;

  private punk = new BehaviorSubject<Punk | null>(null);
  punk$ = this.punk.asObservable();

  private destroy$ = new Subject<void>();

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

  constructor(
    private http: HttpClient,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public stateSvc: StateService,
    public themeSvc: ThemeService,
  ) {
    this.getData();
    this.listPrice.setValue(this.dataSvc.getFloor());

    this.pollReceipt('0x31eeb96a9065817ef3687e3f15098a3314288f703d7431670c989d6d282017a9').then((res) => {
      console.log('pollReceipt', res);
    });
  }

  ngAfterViewInit(): void {
    let mouseDownInsideModal = false;
    merge(
      this.stateSvc.keyDownEscape$,
      this.stateSvc.documentClick$,
      fromEvent<MouseEvent>(this.modal.nativeElement, 'mousedown')
    ).pipe(
      tap(($event: KeyboardEvent | MouseEvent) => {
        const modal = this.modal.nativeElement as HTMLElement;
        const target = $event?.target as HTMLElement;

        if ($event instanceof KeyboardEvent) this.closeAll();

        if ($event.type === 'mousedown' && modal.contains(target)) {
          mouseDownInsideModal = true;
        } else if ($event.type === 'mouseup') {
          if (!mouseDownInsideModal && !modal.contains(target)) this.closeAll();
          mouseDownInsideModal = false;
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getData(): void {
    let punk!: Punk;

    this.route.params.pipe(
      tap((params: any) => this.punk.next({ id: params.tokenId, attributes: [{k:'Loading',v:'Loading'}] })),
      switchMap((params: any) => this.dataSvc.fetchSinglePunk(params.tokenId)),
      // switchMap((resPunk: Punk) => {
      //   punk = resPunk;
      //   this.punk.next(punk);
      //   return this.dataSvc.fetchSinglePunkListing(resPunk.id).pipe(
      //     map((listing: any) => (listing?.value ? { ...punk, listing } : resPunk))
      //   );
      // }),
      tap((res: Punk) => this.punk.next(res)),
      tap((res) => console.log('Punk:', res)),
      takeUntil(this.destroy$),
    ).subscribe();
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
      <p>Transaction hash: <a href="https://etherscan.io/tx/${hash}" target="_blank">${shortHash}</a></p>
      <p>View it <a href="https://etherscan.io/tx/${hash}" target="_blank">here</a></p>
    `).replace(/\s+/g, ' ');

    this.txStatus = { ...this.txStatus };
  }

  setProcessTransactionMessage(receipt: any, message?: string): void {
    // console.log('receipt', receipt);

    this.txModalActive = true;
    this.clearTransaction();

    this.txStatus.complete.active = true;

    const hash = receipt.transactionHash;
    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-6)}`;
    this.txStatus.complete.message = message || `
      <p>Your transaction is complete.</p>
      <p>Transaction hash: <a href="https://etherscan.io/tx/${hash}" target="_blank">${shortHash}</a></p>
      <p>View it <a href="https://etherscan.io/tx/${hash}" target="_blank">here</a></p>
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
    this.closeTxModal();
    this.closeAcceptBid();
    this.closeListing();
    this.closeTransfer();
    this.closeBid();
  }

  async submitListing(punk: Punk): Promise<void> {
    try {
      const tokenId = punk.id;
      const value = this.listPrice.value;
      let address = this.listToAddress.value;

      if (!value) return;
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

      const hash = await this.web3Svc.offerPunkForSale(tokenId, value, address);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async punkNoLongerForSale(punk: Punk): Promise<void> {
    try {
      const tokenId = punk.id;

      this.initTransactionMessage();

      const hash = await this.web3Svc.punkNoLongerForSale(tokenId);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async withdrawBidForPunk(punk: Punk): Promise<void> {
    try {
      const tokenId = punk.id;

      this.initTransactionMessage();

      const hash = await this.web3Svc.withdrawBidForPunk(tokenId);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async acceptBidForPunk(punk: Punk): Promise<void> {
    try {
      const tokenId = punk.id;
      const value = punk.bid?.value;

      this.closeAcceptBid();
      this.initTransactionMessage();

      const hash = await this.web3Svc.acceptBidForPunk(tokenId, value!);
      const shortHash = `${hash?.slice(0, 6)}...${hash?.slice(-6)}`;

      this.setTransactionMessage(
        hash!,
        `<p>Your transaction was sent to the Flashbots builder and is waitng to be processed.</p>
        <p>Transaction hash: <a href="https://etherscan.io/tx/${hash}" target="_blank">${shortHash}</a></p>
        <p>You can <a href="https://etherscan.io/tx/${hash}" target="_blank">view it here</a> once complete.</p>
      `);

      const receipt = await this.pollReceipt(hash!);
      this.setProcessTransactionMessage(receipt);
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

  async buyPunk(punk: Punk): Promise<void> {
    try {
      const tokenId = punk.id;
      const value = punk.listing?.value;

      this.initTransactionMessage();

      const hash = await this.web3Svc.buyPunk(tokenId, value!);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async submitBid(data: Punk): Promise<void> {
    try {
      if (!this.bidPrice.value) return;
      const tokenId = data.id;
      const value = this.bidPrice.value;

      this.closeBid();
      this.initTransactionMessage();

      const hash = await this.web3Svc.enterBidForPunk(tokenId, value);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      console.log(err);
      this.setErrorTransactionMessage(err);
    }
  }

  async submitTransfer(data: Punk): Promise<void> {
    try {
      if (!this.transferAddress.value) return;
      const tokenId = data.id;
      const toAddress = this.transferAddress.value;

      const validAddress = this.web3Svc.verifyAddress(toAddress);
      if (!validAddress) throw new Error('Invalid address');

      this.closeTransfer();
      this.initTransactionMessage();

      const hash = await this.web3Svc.transferPunk(tokenId, toAddress);
      this.setTransactionMessage(hash!);

      const receipt = await this.web3Svc.waitForTransaction(hash!);
      this.setProcessTransactionMessage(receipt);
    } catch (err) {
      this.closeAll();
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
