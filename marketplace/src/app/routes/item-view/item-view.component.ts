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
import { AuctionComponent } from '@/components/auction/auction.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { UtilService } from '@/services/util.service';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import { Subject, filter, firstValueFrom, map, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';

import { environment } from 'src/environments/environment';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { selectNotifications } from '@/state/selectors/notification.selectors';
import { upsertNotification } from '@/state/actions/notification.actions';

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
    AuctionComponent,

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

  explorerUrl = environment.explorerUrl
  escrowAddress = environment.marketAddress;

  sellActive: boolean = false;
  bidActive: boolean = false;
  withdrawActive: boolean = false;
  transferActive: boolean = false;
  acceptbidActive: boolean = false;

  transferAddress = new FormControl<string | null>('');
  bidPrice = new FormControl<number | undefined>(undefined);
  listPrice = new FormControl<number | undefined>(undefined);
  listToAddress = new FormControl<string | null>('');

  objectValues = Object.values;

  refreshPhunk$ = new Subject<void>();

  isCooling$ = this.store.select(appStateSelectors.selectCooldowns).pipe(
    filter((cooldowns) => !!cooldowns),
    switchMap((cooldowns) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => cooldowns[phunk?.hashId || ''] > 0),
    )),
  );

  blocksBehind$ = this.store.select(appStateSelectors.selectBlocksBehind).pipe(
    filter((blocksBehind) => !!blocksBehind),
    map((blocksBehind) => blocksBehind > 6),
  );

  pendingTx$ = this.store.select(selectNotifications).pipe(
    filter((transactions) => !!transactions),
    switchMap((transactions) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => transactions.filter((tx) => tx?.hashId === phunk?.hashId && (tx.type === 'pending' || tx.type === 'wallet'))[0]),
    )),
  );

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  singlePhunk$ = this.store.select(dataStateSelectors.selectSinglePhunk);
  theme$ = this.store.select(appStateSelectors.selectTheme);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private utilSvc: UtilService,
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
    this.closeAll();
    this.acceptbidActive = true;
  }

  closeAcceptBid(): void {
    this.acceptbidActive = false;
    this.clearAll();
  }

  closeListing(): void {
    this.sellActive = false;
    this.clearAll();
  }

  closeTransfer(): void {
    this.transferActive = false;
    this.clearAll();
  }

  closeBid(): void {
    this.bidActive = false;
    this.clearAll();
  }

  clearAll(): void {
    this.listPrice.setValue(undefined);
    this.bidPrice.setValue(undefined);
    this.listToAddress.setValue('');
    this.transferAddress.setValue('');
  }

  closeAll(): void {
    this.closeAcceptBid();
    this.closeListing();
    this.closeTransfer();
    this.closeBid();
  }

  async submitListing(phunk: Phunk): Promise<void> {

    const hashId = phunk.hashId;

    if (!hashId) throw new Error('Invalid hashId');
    if (!this.listPrice.value) return;

    const value = this.listPrice.value;
    let address = this.listToAddress.value || undefined;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('offerPhunkForSale' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'offerPhunkForSale',
      hashId,
      tokenId: phunk.tokenId,
      value,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      if (address) {
        if (address?.endsWith('.eth')) {
          const ensOwner = await this.web3Svc.getEnsOwner(address);
          if (!ensOwner) throw new Error('ENS name not registered');
          address = ensOwner;
        }
        const validAddress = this.web3Svc.verifyAddress(address);
        if (!validAddress) throw new Error('Invalid address');
      }

      let hash;
      if (phunk.isEscrowed) {
        hash = await this.web3Svc.offerPhunkForSale(hashId, value, address);
      } else {
        hash = await this.web3Svc.escrowAndOfferPhunkForSale(hashId, value, address);
      }

      // this.initNotificationMessage();
      this.store.dispatch(upsertNotification({ notification }));

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
      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    }

    this.store.dispatch(upsertNotification({ notification }));
    this.clearAll();
  }

  async sendToEscrow(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;

    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('sendToEscrow' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'sendToEscrow',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      const tokenId = phunk.hashId;
      const hash = await this.web3Svc.sendEthscriptionToContract(tokenId);

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      // this.setNotificationCompleteMessage(receipt);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    }

    this.store.dispatch(upsertNotification({ notification }));
  }

  async phunkNoLongerForSale(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('phunkNoLongerForSale' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'phunkNoLongerForSale',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {

      const hash = await this.web3Svc.phunkNoLongerForSale(hashId);

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

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    }

    this.store.dispatch(upsertNotification({ notification }));
  }

  async buyPhunk(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    const value = phunk.listing?.minValue;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('buyPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'buyPhunk',
      hashId,
      tokenId: phunk.tokenId,
      value: Number(this.web3Svc.weiToEth(value)),
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);
      if (!phunk.prevOwner) throw new Error('Invalid prevOwner');

      const hash = await this.web3Svc.batchBuyPhunks([phunk]);
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

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    }

    this.store.dispatch(upsertNotification({ notification }));
  }

  async transferPhunk(phunk: Phunk, address?: string): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('transferPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'transferPhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    try {
      let toAddress: string | null = address || this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      this.closeTransfer();
      this.store.dispatch(upsertNotification({ notification }));

      await this.checkConsenus(phunk);

      const hash = await this.web3Svc.transferPhunk(hashId, toAddress);
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

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    }

    this.store.dispatch(upsertNotification({ notification }));
    this.clearAll();
  }

  async withdrawPhunk(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('withdrawPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'withdrawPhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    try {
      this.store.dispatch(upsertNotification({ notification }));

      const hash = await this.web3Svc.withdrawPhunk(hashId);
      if (!hash) throw new Error('Could not proccess transaction');
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

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  getItemQueryParams(item: any): any {
    if (!item) return;
    return { [item.k.replace(/ /g, '-').toLowerCase()]: item.v.replace(/ /g, '-').toLowerCase() };
  }

  async checkConsenus(phunk: Phunk): Promise<void> {
    const res = await this.dataSvc.checkConsensus([phunk]);
    if (!res[0]?.consensus) throw new Error('Consensus not reached. Contact Support @etherphunks');
  }

  // async sendToAuction(hashId: string) {
  //   const proof = await firstValueFrom(this.dataSvc.fetchProofs(hashId));
  //   console.log(proof);
  //   await this.web3Svc.transferPhunk(proof, environment.auctionAddress);
  // }
}
