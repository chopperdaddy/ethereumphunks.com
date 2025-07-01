import { Component, ElementRef, input, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, switchMap } from 'rxjs';
import { signTypedData } from '@wagmi/core';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from '@/services/web3.service';
import { UtilService } from '@/services/util.service';
import { DataService } from '@/services/data.service';

import { selectBlocksBehind, selectCooldowns, selectWalletAddress } from '@/state/app/app-state.selectors';
import { upsertNotification } from '@/state/notification/notification.actions';
import { addCooldown } from '@/state/app/app-state.actions';

import { environment } from '@environments/environment';
import { selectNotifications } from '@/state/notification/notification.selectors';

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
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  selector: 'app-item-actions',
  templateUrl: './item-actions.component.html',
  styleUrls: ['./item-actions.component.scss'],
})
export class ItemActionsComponent {

  phunk = input.required<Phunk>();
  phunk$ = toObservable(this.phunk);

  // Other Forms
  @ViewChild('sellPriceInput') sellPriceInput!: ElementRef<HTMLInputElement>;
  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;
  // @ViewChild('revShareInput') revShareInput!: ElementRef<HTMLInputElement>;

  // Auction Forms
  @ViewChild('auctionDurationInput') auctionDurationInput!: ElementRef<HTMLInputElement>;
  @ViewChild('auctionMinBidIncrementPercentageInput') auctionMinBidIncrementPercentageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('auctionTimeBufferInput') auctionTimeBufferInput!: ElementRef<HTMLInputElement>;

  // Collapsable
  @ViewChildren('collapsable') collapsable!: QueryList<ElementRef<HTMLDivElement>>;

  actionsState = signal<ActionsState>({
    sell: false,
    withdraw: false,
    transfer: false,
    escrow: false,
    bridge: false,
    privateSale: false,
    auction: false,
  });

  walletAddress$ = this.store.select(selectWalletAddress);
  blocksBehind$ = this.store.select(selectBlocksBehind).pipe(
    filter((blocksBehind) => !!blocksBehind),
    map((blocksBehind) => blocksBehind > 6),
  );

  pendingTx$ = this.store.select(selectNotifications).pipe(
    filter((transactions) => !!transactions),
    switchMap((transactions) => this.phunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => transactions.filter((tx) => tx?.hashId === phunk?.hashId && (tx.type === 'pending' || tx.type === 'wallet'))[0]),
    )),
  );

  isCooling$ = this.store.select(selectCooldowns).pipe(
    filter((cooldowns) => !!cooldowns),
    switchMap((cooldowns) => this.phunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => cooldowns[phunk?.hashId || ''] > 0),
    )),
  );

  transferAddress = new FormControl<string | null>('');
  listPrice = new FormControl<number | undefined>(undefined);
  auctionDuration = new FormControl<number | undefined>(undefined);
  auctionMinBidIncrementPercentage = new FormControl<number | undefined>(undefined);
  auctionTimeBuffer = new FormControl<number | undefined>(undefined);
  listToAddress = new FormControl<string | null>('');
  // revShare = new FormControl<number | undefined>(undefined);

  escrowAddress = environment.marketAddress;
  externalMarketUrl = environment.externalMarketUrl;
  bridgeAddress = environment.bridgeAddress;

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    public web3Svc: Web3Service,
    private utilSvc: UtilService,
    public dataSvc: DataService,
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

  async submitListing(): Promise<void> {
    const phunk = this.phunk();
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
      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async sendToEscrow(): Promise<void> {
    const phunk = this.phunk();
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

      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async phunkNoLongerForSale(): Promise<void> {
    const phunk = this.phunk();
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

      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async buyPhunk(): Promise<void> {
    const phunk = this.phunk();
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

      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async transferPhunk(address?: string): Promise<void> {
    const phunk = this.phunk();
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

      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async withdrawPhunk(): Promise<void> {
    const phunk = this.phunk();
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

      this.store.dispatch(addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
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

  async bridge(): Promise<void> {
    const phunk = this.phunk();
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

  async sendToAuction() {
    const phunk = this.phunk();
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

  async setChat() {
    // TODO: set chat
    console.log('setChat');
    // this.store.dispatch(setChat({
    //   active: true,
    //   conversationId: '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7'
    // }));
  }
}
