import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ViewChild, ViewChildren, ElementRef, QueryList, Component, signal } from '@angular/core';

import { signTypedData } from '@wagmi/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { distinctUntilChanged, filter, firstValueFrom, fromEvent, map, shareReplay, switchMap } from 'rxjs';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { BreadcrumbsComponent } from '@/components/breadcrumbs/breadcrumbs.component';
import { AuctionComponent } from '@/components/auction/auction.component';
import { CommentsComponent } from '@/components/comments/comments.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { QueryParamsPipe } from '@/pipes/query-params.pipe';
import { IsNumberPipe } from '@/pipes/is-number';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { UtilService } from '@/services/util.service';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import * as appStateActions from '@/state/app/app-state.actions';
import * as appStateSelectors from '@/state/app/app-state.selectors';

import * as dataStateSelectors from '@/state/data/data-state.selectors';

import { selectNotifications } from '@/state/notification/notification.selectors';
import { upsertNotification } from '@/state/notification/notification.actions';

import { setChat } from '@/state/chat/chat.actions';

import { environment } from '@environments/environment';

interface ActionsState {
  sell: boolean;
  withdraw: boolean;
  transfer: boolean;
  escrow: boolean;
  bridge: boolean;
  privateSale: boolean;
  auction: boolean;
};

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

    TraitCountPipe,
    WeiToEthPipe,
    FormatCashPipe,
    QueryParamsPipe,
    IsNumberPipe,
  ],
  selector: 'app-phunk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})
export class ItemViewComponent {

  objectValues = Object.values;

  @ViewChild('sellPriceInput') sellPriceInput!: ElementRef<HTMLInputElement>;
  // @ViewChild('revShareInput') revShareInput!: ElementRef<HTMLInputElement>;
  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;

  // Auction Form
  @ViewChild('auctionDurationInput') auctionDurationInput!: ElementRef<HTMLInputElement>;
  @ViewChild('auctionMinBidIncrementPercentageInput') auctionMinBidIncrementPercentageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('auctionTimeBufferInput') auctionTimeBufferInput!: ElementRef<HTMLInputElement>;

  @ViewChildren('collapsable') collapsable!: QueryList<ElementRef<HTMLDivElement>>;

  explorerUrl = environment.explorerUrl;
  externalMarketUrl = environment.externalMarketUrl;
  escrowAddress = environment.marketAddress;
  bridgeAddress = environment.bridgeAddress;

  actionsState = signal<ActionsState>({
    sell: false,
    withdraw: false,
    transfer: false,
    escrow: false,
    bridge: false,
    privateSale: false,
    auction: false,
  });

  transferAddress = new FormControl<string | null>('');
  listPrice = new FormControl<number | undefined>(undefined);
  auctionDuration = new FormControl<number | undefined>(undefined);
  auctionMinBidIncrementPercentage = new FormControl<number | undefined>(undefined);
  auctionTimeBuffer = new FormControl<number | undefined>(undefined);
  // revShare = new FormControl<number | undefined>(undefined);
  listToAddress = new FormControl<string | null>('');

  singlePhunk$ = this.route.params.pipe(
    filter((params: any) => !!params.hashId),
    distinctUntilChanged((prev, curr) => prev.hashId === curr.hashId),
    switchMap((params: any) => this.dataSvc.fetchSinglePhunk(params.hashId)),
    shareReplay(1),
  );

  pendingTx$ = this.store.select(selectNotifications).pipe(
    filter((transactions) => !!transactions),
    switchMap((transactions) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => transactions.filter((tx) => tx?.hashId === phunk?.hashId && (tx.type === 'pending' || tx.type === 'wallet'))[0]),
    )),
  );

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

  globalConfig$ = this.store.select(appStateSelectors.selectConfig);
  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  theme$ = this.store.select(appStateSelectors.selectTheme);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  scrollY$ = fromEvent(document, 'scroll').pipe(
    map(() => (window.scrollY / 2) * -1),
  );

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);

  expanded = false;

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private utilSvc: UtilService,
  ) {}

  sellPhunk(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, sell: true }));
    setTimeout(() => this.sellPriceInput?.nativeElement.focus(), 0);
  }

  escrowPhunk(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, escrow: true }));
  }

  transferPhunkAction(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, transfer: true }));
    setTimeout(() => this.transferAddressInput?.nativeElement.focus(), 0);
  }

  bridgePhunkAction(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, bridge: true }));
  }

  privateSalePhunkAction(): void {
    this.actionsState.update((state) => ({ ...state, privateSale: true }));
  }

  auctionPhunkAction(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, auction: true }));
  }

  closeListing(): void {
    this.actionsState.update((state) => ({ ...state, sell: false }));
    this.closePrivateSale();
    this.clearAll();
  }

  closeEscrow(): void {
    this.actionsState.update((state) => ({ ...state, escrow: false }));
  }

  closeTransfer(): void {
    this.actionsState.update((state) => ({ ...state, transfer: false }));
    this.clearAll();
  }

  closeBridge(): void {
    this.actionsState.update((state) => ({ ...state, bridge: false }));
  }

  closePrivateSale(): void {
    this.actionsState.update((state) => ({ ...state, privateSale: false }));
  }

  closeAuction(): void {
    this.actionsState.update((state) => ({ ...state, auction: false }));
  }

  clearAll(): void {
    this.listPrice.setValue(undefined);
    this.listToAddress.setValue('');
    this.transferAddress.setValue('');
  }

  closeAll(): void {
    this.closeListing();
    this.closeTransfer();
    this.closeEscrow();
    this.closeBridge();
    this.closeAuction();
  }

  async submitListing(phunk: Phunk): Promise<void> {

    const hashId = phunk.hashId;

    if (!hashId) throw new Error('Invalid hashId');
    if (!this.listPrice.value) return;

    const value = this.listPrice.value;
    // const revShare = (this.revShare.value || 0) * 1000;
    let address = this.listToAddress.value || undefined;

    // console.log({hashId, value, address});

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
      } else if (phunk.nft) {
        hash = await this.web3Svc.offerPhunkForSaleL2(hashId, value, address);
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
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
      this.clearAll();
    }
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
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
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

      let hash;
      if (phunk.nft) {
        hash = await this.web3Svc.phunkNoLongerForSaleL2(hashId);
      } else {
        hash = await this.web3Svc.phunkNoLongerForSale(hashId);
      }
      if (!hash) throw new Error('Could not process transaction');

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
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
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

      let hash: string | undefined = undefined;
      if (phunk.nft) {
        hash = await this.web3Svc.buyPhunkL2(hashId);
      } else {
        hash = await this.web3Svc.batchBuyPhunks([phunk]);
      }

      if (!hash) throw new Error('Could not process transaction');

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
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
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
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
      this.clearAll();
    }
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
      if (!hash) throw new Error('Could not process transaction');
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

  async bridge(phunk: Phunk): Promise<void> {

    const hashId = phunk.hashId;

    const config = this.web3Svc.config;
    const chainId = config.getClient().chain.id;

    const address = await this.web3Svc.getCurrentAddress();
    if (!address) throw new Error('Invalid user address');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('bridgeOut' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'bridgeOut',
      hashId,
      tokenId: phunk.tokenId,
    };

    try {
      this.store.dispatch(upsertNotification({ notification }));

      const baseUrl = environment.relayUrl;
      const nonceUrl = `${baseUrl}/generate-nonce`;
      const nonceResult = await firstValueFrom(
        this.http.get(nonceUrl, { params: { address }, responseType: 'text' })
      );

      // const signature = await signMessage(config, {
      //   message: `Sign this message to verify ownership of the asset.\n\nAddress: ${address.toLowerCase()}\nEthscription ID: ${phunk.hashId}\nSHA: ${phunk.sha}\nNonce: ${nonceResult}\nChain ID: ${chainId}`,
      // });

      const typedData: any = {
        domain: {
          name: 'EtherPhunks',
          version: '1',
          chainId: BigInt(chainId),
        },
        message: {
          address: address as `0x${string}`,
          hashId: phunk.hashId,
          sha: phunk.sha,
          nonce: nonceResult,
          chainId: BigInt(chainId),
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Bridge: [
            { name: 'address', type: 'address' },
            { name: 'hashId', type: 'string' },
            { name: 'sha', type: 'string' },
            { name: 'nonce', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
        },
        primaryType: 'Bridge',
      };

      const signature = await signTypedData(config, typedData);

      const relayUrl = `${baseUrl}/bridge-phunk`;
      const relayResponse: any = await firstValueFrom(
        this.http.post(relayUrl, {
          address,
          hashId: phunk.hashId,
          sha: phunk.sha,
          signature,
          chainId,
        }, {
          headers: {
            'x-api-key': 'yY.nnrLrRQ_gL.kGWb*QRCYqs3YJNtjVGXfoNLpfwwenH@FL',
          }
        })
      );

      const hexArr = [
        relayResponse.hashId,
        relayResponse.signature.r,
        relayResponse.signature.s,
        relayResponse.signature.v,
      ];

      const hash = await this.web3Svc.lockPhunk(hexArr);
      if (!hash) throw new Error('Could not process transaction');
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

      // this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    } finally {
      this.closeBridge();
    }
  }

  async sendToAuction(phunk: Phunk) {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    // console.log('sendToAuction', {phunk: phunk.hashId, duration: this.auctionDuration.value, minBidIncrementPercentage: this.auctionMinBidIncrementPercentage.value, timeBuffer: this.auctionTimeBuffer.value});

    if (!this.auctionDuration.value || !this.auctionMinBidIncrementPercentage.value || !this.auctionTimeBuffer.value) throw new Error('Invalid auction parameters');

    const hash = await this.web3Svc.sendToAuction(
      hashId,
      Number(this.auctionDuration.value),
      Number(this.auctionMinBidIncrementPercentage.value),
      Number(this.auctionTimeBuffer.value)
    );

    console.log('sendToAuction', {hash});
  }

  async checkConsenus(phunk: Phunk): Promise<void> {
    const res = await this.dataSvc.checkConsensus([phunk]);
    if (!res[0]?.consensus) throw new Error('Consensus not reached. Contact Support @etherphunks');
  }

  expand(): void {
    this.expanded = !this.expanded;
  }

  async setChat() {
    // TODO: set chat
    console.log('setChat');
    // this.store.dispatch(setChat({
    //   active: true,
    //   conversationId: '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7'
    // }));
  }
}
