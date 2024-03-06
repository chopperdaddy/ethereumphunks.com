import { Injectable, NgZone } from '@angular/core';

import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { Observable, catchError, filter, of, tap } from 'rxjs';

import PointsAbi from '@/abi/Points.json';
import DonationsAbi from '@/abi/Contributions.json';
import { EtherPhunksMarketABI } from '@/abi/EtherPhunksMarket';
import AuctionAbi from '@/abi/EtherPhunksAuctionHouse.json';

import { reconnect, http, createConfig, Config, watchAccount, getPublicClient, getAccount, disconnect, getChainId, switchChain, getWalletClient, GetWalletClientReturnType, GetAccountReturnType } from '@wagmi/core';
import { coinbaseWallet, walletConnect, injected } from '@wagmi/connectors';

import * as appStateActions from '@/state/actions/app-state.actions';

import { Chain, mainnet, sepolia } from 'viem/chains';
import { magma } from '@/constants/magmaChain';

import { Web3Modal } from '@web3modal/wagmi/dist/types/src/client';
import { createWeb3Modal } from '@web3modal/wagmi';
import { Account, TransactionReceipt, WatchBlockNumberReturnType, decodeFunctionData, formatEther, isAddress, parseEther, zeroAddress } from 'viem';

const marketAddress = environment.marketAddress;
const pointsAddress = environment.pointsAddress;
// const auctionAddress = environment.auctionAddress;
// const donationsAddress = environment.donationsAddress;

const projectId = 'd183619f342281fd3f3ff85716b6016a';

const metadata = {
  name: 'Ethereum Phunks',
  description: '',
  url: 'https://ethereumphunks.com',
  icons: []
};

const themeVariables = {
  '--w3m-font-family': 'Montserrat, sans-serif',
  '--w3m-accent': 'rgba(var(--highlight), 1)',
  '--w3m-z-index': 99999,
  '--w3m-border-radius-master': '0',
};

@Injectable({
  providedIn: 'root'
})

export class Web3Service {

  maxCooldown = 4;
  web3Connecting: boolean = false;
  connectedState!: Observable<any>;

  config!: Config;
  modal!: Web3Modal;

  constructor(
    private store: Store<GlobalState>,
    private ngZone: NgZone
  ) {

    const chains: [Chain, ...Chain[]] = environment.chainId === 1 ? [mainnet] : [sepolia];

    this.config = createConfig({
      chains,
      transports: {
        [environment.chainId]: http(environment.rpcHttpProvider),
        // 6969696969: http(environment.magmaRpcHttpProvider)
      },
      connectors: [
        walletConnect({ projectId, metadata, showQrModal: false }),
        injected({ shimDisconnect: true }),
        coinbaseWallet({
          appName: metadata.name,
          appLogoUrl: metadata.icons[0]
        })
      ]
    });

    this.modal = createWeb3Modal({
      wagmiConfig: this.config,
      projectId,
      enableAnalytics: false,
      themeVariables,
    })

    this.createListeners();
    this.startBlockWatcher();
  }

  createListeners(): void {
    this.connectedState = new Observable((observer) => watchAccount(this.config, {
      onChange: (account) => this.ngZone.run(() => observer.next(account))
    }));

    this.connectedState.pipe(
      tap((account: GetAccountReturnType) => {
        this.store.dispatch(appStateActions.setConnected({ connected: account.isConnected }));
        this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: account.address }));
      }),
      catchError((err) => {
        this.disconnectWeb3();
        return of(err);
      }),
    ).subscribe();

    reconnect(this.config);
  }

  blockWatcher!: WatchBlockNumberReturnType | undefined;
  startBlockWatcher(): void {
    if (this.blockWatcher) return;
    this.blockWatcher = getPublicClient(this.config)?.watchBlockNumber({
      emitOnBegin: true,
      onBlockNumber: (blockNumber) => {
        const currentBlock = Number(blockNumber);
        this.store.dispatch(appStateActions.setCurrentBlock({ currentBlock }));
      }
    });
  }

  async connect(): Promise<void> {
    try {
      await this.modal.open();
    } catch (error) {
      console.log(error);
      this.disconnectWeb3();
    }
  }

  async disconnectWeb3(): Promise<void> {
    if (getAccount(this.config).isConnected) {
      await disconnect(this.config);
      this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: '' }));
      this.store.dispatch(appStateActions.setConnected({ connected: false }));
    }
  }

  async switchNetwork(): Promise<void> {
    const chainId = getChainId(this.config);
    if (!chainId) return;
    if (chainId !== environment.chainId) {
      await switchChain(this.config, { chainId: environment.chainId });
    }
  }

  async getActiveWalletClient(): Promise<GetWalletClientReturnType> {
    return await getWalletClient(this.config);
  }

  async checkHasWithdrawal(address: string): Promise<number> {
    const pendingWithdrawals = await this.readMarketContract('pendingWithdrawalsV2', [address]);
    return Number(pendingWithdrawals);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CONTRACT METHODS //////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async isInEscrow(tokenId: string): Promise<boolean> {
    const address = getAccount(this.config).address;
    if (!address) return false;

    const isInEscrow = await this.readMarketContract('userEthscriptionPossiblyStored', [address, tokenId]);
    return !!isInEscrow;
  }

  async sendEthscriptionToContract(tokenId: string): Promise<string | undefined> {
    const escrowed = await this.isInEscrow(tokenId);
    if (escrowed) throw new Error('Phunk already in escrow');
    return await this.transferPhunk(tokenId, marketAddress as `0x${string}`);
  }

  async withdrawPhunk(hashId: string): Promise<string | undefined> {
    const escrowed = await this.isInEscrow(hashId);
    if (!escrowed) throw new Error('Phunk not in escrow');
    return await this.writeMarketContract('withdrawPhunk', [hashId]);
  }

  async withdrawBatch(hashIds: string[]): Promise<string | undefined> {
    if (!hashIds.length) throw new Error('No phunks selected');
    return await this.writeMarketContract('withdrawBatchPhunks', [hashIds]);
  }

  async decodeInputData(data: string): Promise<any> {
    const decoded = decodeFunctionData({
      abi: EtherPhunksMarketABI,
      data: data as `0x${string}`,
    });
    return decoded;
  }

  async writeMarketContract(
    functionName: string,
    args: any[],
    value?: string
  ): Promise<string | undefined> {
    if (!functionName) return;
    await this.switchNetwork();

    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });
    const publicClient = getPublicClient(this.config);

    if (!publicClient) throw new Error('No public client');

    const paused = await this.readMarketContract('paused', []);

    // console.log({ paused, whitelist, functionName });
    // const whitelist = ['batchOfferPhunkForSale', 'offerPhunkForSale', 'phunkNoLongerForSale', 'withdrawPhunk'];
    // if (paused && whitelist.indexOf(functionName) === -1) throw new Error('Contract is paused');
    if (paused) throw new Error('Contract is paused');

    const tx: any = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI,
      functionName,
      args,
      account: walletClient?.account?.address as `0x${string}`,
    };
    if (value) tx.value = value;

    const { request, result } = await publicClient.simulateContract(tx);
    console.log(request, result);

    return await walletClient?.writeContract(request);
  }

  async readMarketContract(functionName: any, args: (string | undefined)[]): Promise<any> {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    const call: any = await publicClient.readContract({
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI,
      functionName,
      args: args as any,
    });

    return call;
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    const transaction = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    return transaction;
  }

  async offerPhunkForSale(hashId: string, value: number, toAddress?: string | null): Promise<string | undefined> {
    // console.log('offerPhunkForSale', tokenId, value, toAddress);

    const weiValue = value * 1e18;
    if (toAddress) {
      if (!isAddress(toAddress)) throw new Error('Invalid address');
      return this.writeMarketContract(
        'offerPhunkForSaleToAddress',
        [hashId, weiValue, toAddress]
      );
    }

    return this.writeMarketContract(
      'offerPhunkForSale',
      [hashId, weiValue]
    );
  }

  async escrowAndOfferPhunkForSale(
    hashId: string,
    value: number,
    toAddress: string = zeroAddress
  ): Promise<string | undefined> {
    const weiValue = value * 1e18;

    const sig = '4445504f5349545f414e445f4c4953545f5349474e4154555245000000000000';
    const bytes32Value = weiValue.toString(16).padStart(64, '0');
    toAddress = toAddress.toLowerCase().replace('0x', '').padStart(64, '0');

    return await this.batchTransferPhunks([hashId, sig, bytes32Value, toAddress], marketAddress);
  }

  async batchOfferPhunkForSale(hashIds: string[], listPrices: number[]): Promise<string | undefined> {
    const weiValues = listPrices.map((price) => this.ethToWei(price));
    return this.writeMarketContract('batchOfferPhunkForSale', [hashIds, weiValues]);
  }

  async batchBuyPhunks(
    phunks: Phunk[]
  ): Promise<string | undefined> {

    const address = getAccount(this.config).address;

    const escrowAndListing = await this.fetchMultipleEscrowAndListing(phunks);

    const hashIds = [];
    const minSalePricesInWei = [];

    let total = BigInt(0);

    for (const [i, phunk] of phunks.entries()) {
      const hashId = phunk.hashId;
      const stored = escrowAndListing[hashId].stored;
      const listed = escrowAndListing[hashId][0];
      const listedBy = escrowAndListing[hashId][2];

      if (
        !phunk.listing ||
        !listed ||
        !stored ||
        listedBy.toLowerCase() !== phunk.prevOwner?.toLowerCase() ||
        phunk.prevOwner?.toLowerCase() === address?.toLowerCase()
      ) continue;

      hashIds.push(phunk.hashId);
      minSalePricesInWei.push(BigInt(phunk.listing.minValue));
      total += BigInt(phunk.listing.minValue);
    }

    if (!hashIds.length || !minSalePricesInWei.length) throw new Error('No phunks selected');

    console.log({ hashIds, minSalePricesInWei, total });

    return this.writeMarketContract(
      'batchBuyPhunk',
      [hashIds, minSalePricesInWei],
      total as any
    );
  }

  async phunkNoLongerForSale(hashId: string): Promise<string | undefined> {
    return this.writeMarketContract('phunkNoLongerForSale', [hashId]);
  }

  async transferPhunk(hashId: string, toAddress: string): Promise<string | undefined> {
    if (!hashId) throw new Error('No phunk selected');
    if (!toAddress) throw new Error('No address provided');

    await this.switchNetwork();

    const wallet = await getWalletClient(this.config);
    return wallet?.sendTransaction({
      chain: wallet.chain,
      account: getAccount(this.config).address as `0x${string}`,
      to: toAddress as `0x${string}`,
      value: BigInt(0),
      data: hashId as `0x${string}`,
    });
  }

  async batchTransferPhunks(hashIds: string[], toAddress: string | null): Promise<string | undefined> {
    if (!hashIds.length) throw new Error('No phunks selected');
    if (!toAddress) throw new Error('No address provided');
    const hash = hashIds.map((res) => res.replace('0x', '')).join('');
    return await this.transferPhunk(`0x${hash}`, toAddress);
  }

  async withdraw(): Promise<any> {
    const hash = await this.writeMarketContract('withdraw', []);
    const receipt = await this.waitForTransaction(hash!);
    return await this.checkHasWithdrawal(receipt.from);
  }

  async getUserPoints(address: string): Promise<number> {
    const publicClient = getPublicClient(this.config);
    const points = await publicClient?.readContract({
      address: pointsAddress as `0x${string}`,
      abi: PointsAbi,
      functionName: 'points',
      args: [address],
    });
    return Number(points);
  }

  async getMultiplier(): Promise<any> {
    const publicClient = getPublicClient(this.config);
    const multiplier = await publicClient?.readContract({
      address: pointsAddress as `0x${string}`,
      abi: PointsAbi,
      functionName: 'multiplier',
      args: [],
    });
    return multiplier;
  }

  async fetchEscrowAndListing(prevOwner: string, hashId: string): Promise<any> {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    const contract = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI as any
    };

    const multicall = await publicClient.multicall({
      contracts: [{
        ...contract,
        functionName: 'userEthscriptionPossiblyStored',
        args: [prevOwner as `0x${string}`, hashId as `0x${string}`],
      },
      {
        ...contract,
        functionName: 'phunksOfferedForSale',
        args: [hashId as `0x${string}`],
      }]
    });

    console.log({multicall});

    return multicall;
  }

  async fetchMultipleEscrowAndListing(phunks: Phunk[]): Promise<any> {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    const contract = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI
    };

    const calls: any[] = [];
    for (const phunk of phunks) {
      calls.push({
        ...contract,
        functionName: 'userEthscriptionPossiblyStored',
        args: [phunk.prevOwner as `0x${string}`, phunk.hashId as `0x${string}`],
      });
      calls.push({
        ...contract,
        functionName: 'phunksOfferedForSale',
        args: [phunk.hashId as `0x${string}`],
      });
    }

    const res = await publicClient.multicall({ contracts: calls });

    console.log({res})

    const combined: any = {};
    for (let i = 0; i < res.length; i += 2) {
      const hashId = (res[i + 1] as any).result[1];
      if (!hashId) continue;
      combined[hashId] = {
        stored: (res[i] as any).result,
        ...(res[i + 1] as any).result,
      };
    }
    return combined;
  }

  //////////////////////////////////
  // TXNS //////////////////////////
  //////////////////////////////////

  async getTransaction(hash: string): Promise<any> {
    const publicClient = getPublicClient(this.config);
    const transaction = await publicClient?.getTransaction({ hash: hash as `0x${string}` });
    return transaction;
  }

  async getTransactionReceipt(hash: string): Promise<TransactionReceipt | undefined> {
    const publicClient = getPublicClient(this.config);
    const receipt = await publicClient?.getTransactionReceipt({ hash: hash as `0x${string}` });
    return receipt;
  }

  pollReceipt(hash: string): Promise<TransactionReceipt> {
    let resolved = false;
    return new Promise(async (resolve, reject) => {
      while (!resolved) {
        console.log('polling');
        try {
          const receipt = await this.waitForTransaction(hash);
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

  async getActiveWalletAddress(): Promise<string | null> {
    const walletClient = await getWalletClient(this.config);
    const address = walletClient?.account?.address as `0x${string}`;
    return address;
  }

  //////////////////////////////////
  // UTILS /////////////////////////
  //////////////////////////////////

  async getCurrentBlock(): Promise<number> {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    const blockNum = await publicClient.getBlockNumber();
    return Number(blockNum);
  }

  ethToWei(eth: number): bigint {
    return parseEther(`${eth}`, 'wei');
  }

  weiToEth(wei: any): string {
    return formatEther(wei);
  }

  async verifyAddressOrEns(address: string | null): Promise<string | null> {
    try {
      if (!address) throw new Error('No address provided');

      address = address.toLowerCase();
      const isEns = address?.includes('.eth');
      const isAddress = this.verifyAddress(address);

      if (!isEns && !isAddress) throw new Error('Invalid Address');

      if (isEns) address = await this.getEnsOwner(address);
      else address = this.verifyAddress(address);

      if (!address) throw new Error('Invalid Address');
      return address;
    } catch (error) {
      console.log(error)
      return null;
    }
  }

  verifyAddress(address: string | null): string | null {
    if (!address) return null;
    const valid = isAddress(address);
    if (valid) return address.toLowerCase();
    return null;
  }

  async getEnsOwner(name: string) {
    const publicClient = getPublicClient(this.config);
    if (!publicClient) throw new Error('No public client');

    return await publicClient.getEnsAddress({ name });
  }

  async getEnsFromAddress(address: string | null | undefined): Promise<string | null> {
    if (!address) return null;
    try {
      const publicClient = getPublicClient(this.config);
      if (!publicClient) throw new Error('No public client');

      const ens = await publicClient.getEnsName({ address: address as `0x${string}` });
      return ens;
    } catch (err) {
      return null;
    }
  }
}
