import { Injectable, NgZone } from '@angular/core';

import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';

import { Observable, catchError, filter, of, tap } from 'rxjs';

import PointsAbi from '@/abi/Points.json';
import DonationsAbi from '@/abi/Contributions.json';
import EtherPhunksMarketAbi from '@/abi/EtherPhunksMarket.json';
import AuctionAbi from '@/abi/EtherPhunksAuctionHouse.json';

import { TransactionReceipt, WatchBlockNumberReturnType, decodeFunctionData, encodeFunctionData, formatEther, getContract, isAddress, numberToBytes, numberToHex, parseEther, zeroAddress } from 'viem';
import { mainnet, goerli } from 'viem/chains';

import { EIP6963Connector, createWeb3Modal, walletConnectProvider } from '@web3modal/wagmi';
import { Web3Modal } from '@web3modal/wagmi/dist/types/src/client';

import { jsonRpcProvider } from '@wagmi/core/providers/jsonRpc';
import { WalletConnectConnector } from '@wagmi/core/connectors/walletConnect';
import { CoinbaseWalletConnector } from '@wagmi/core/connectors/coinbaseWallet';

import { configureChains, createConfig, disconnect, getAccount, getNetwork, getPublicClient, getWalletClient, switchNetwork, watchAccount, InjectedConnector } from '@wagmi/core';

import * as appStateActions from '@/state/actions/app-state.actions';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

const marketAddress = environment.marketAddress;
const pointsAddress = environment.pointsAddress;
// const auctionAddress = environment.auctionAddress;
// const donationsAddress = environment.donationsAddress;

const projectId = 'd183619f342281fd3f3ff85716b6016a';

const themeVariables = {
  '--w3m-font-family': 'Montserrat, sans-serif',
  '--w3m-accent': 'rgba(var(--highlight), 1)',
  '--w3m-z-index': 999,
  '--w3m-border-radius-master': '0',
};

@Injectable({
  providedIn: 'root'
})

export class Web3Service {

  maxCooldown = 4;
  web3Connecting: boolean = false;
  connectedState!: Observable<any>;

  modal!: Web3Modal;

  constructor(
    private store: Store<GlobalState>,
    private ngZone: NgZone
  ) {
    const { chains, publicClient } = configureChains([mainnet, goerli], [
      jsonRpcProvider({ rpc: () => ({ http: environment.rpcHttpProvider }) }),
      walletConnectProvider({ projectId }),
    ]);

    const metadata = {
      name: 'Ethereum Phunks',
      description: '',
      url: 'https://ethereumphunks.com',
    };

    const wagmiConfig = createConfig({
      autoConnect: true,
      connectors: [
        new WalletConnectConnector({ chains, options: { projectId, showQrModal: false } }),
        new EIP6963Connector({ chains }),
        new InjectedConnector({ chains, options: { shimDisconnect: true } }),
        new CoinbaseWalletConnector({ chains, options: { appName: metadata.name }}),
      ],
      publicClient
    });

    this.modal = createWeb3Modal({
      wagmiConfig,
      projectId,
      chains,
      themeVariables,
      defaultChain: mainnet,
    });

    this.createListeners();
  }

  createListeners(): void {
    this.connectedState = new Observable((observer) => watchAccount((account) => {
      this.ngZone.run(() => observer.next(account));
    }));
    this.connectedState.pipe(
      tap((account) => { if (account.isDisconnected) this.disconnectWeb3(); }),
      filter((account) => account.isConnected),
      tap((account) => this.connectWeb3(account.address as string)),
      // tap((account) => this.connectWeb3(`0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca`)),
      catchError((err) => {
        this.disconnectWeb3();
        return of(err);
      }),
    ).subscribe();
  }

  blockWatcher!: WatchBlockNumberReturnType | undefined;
  startBlockWatcher(): void {
    if (this.blockWatcher) return;
    this.blockWatcher = getPublicClient().watchBlockNumber({
      emitOnBegin: true,
      onBlockNumber: (blockNumber) => {
        const currentBlock = Number(blockNumber);
        this.store.dispatch(appStateActions.newBlock({ blockNumber: currentBlock }));
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

  async connectWeb3(address: string): Promise<void> {
    if (!address) return;
    address = address.toLowerCase();

    await this.switchNetwork();

    this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: address }));
    this.store.dispatch(appStateActions.setConnected({ connected: true }));

    this.startBlockWatcher();
  }

  async disconnectWeb3(): Promise<void> {
    if (getAccount().isConnected) {
      await disconnect();
      this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: '' }));
      this.store.dispatch(appStateActions.setConnected({ connected: getAccount().isConnected }));
    }
  }

  async switchNetwork(): Promise<void> {
    if (this.checkNetwork() !== environment.chainId) {
      await switchNetwork({ chainId: environment.chainId });
    }
  }

  async checkHasWithdrawal(address: string): Promise<number> {
    const publicClient = getPublicClient();
    const pendingWithdrawals = await publicClient?.readContract({
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketAbi,
      functionName: 'pendingWithdrawals',
      args: [address],
    });
    return Number(pendingWithdrawals);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CONTRACT METHODS //////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async isInEscrow(tokenId: string): Promise<boolean> {
    const publicClient = getPublicClient();
    const isInEscrow = await publicClient?.readContract({
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketAbi,
      functionName: 'userEthscriptionPossiblyStored',
      args: [getAccount().address, tokenId],
    });
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
    return await this.marketContractInteraction('withdrawPhunk', [hashId]);
  }

  async withdrawBatch(hashIds: string[]): Promise<string | undefined> {
    if (!hashIds.length) throw new Error('No phunks selected');
    return await this.marketContractInteraction('withdrawBatchPhunks', [hashIds]);
  }

  async decodeInputData(data: string): Promise<any> {
    const decoded = decodeFunctionData({
      abi: EtherPhunksMarketAbi,
      data: data as `0x${string}`,
    });
    return decoded;
  }

  async marketContractInteraction(
    functionName: string,
    args: any[],
    value?: string
  ): Promise<string | undefined> {
    if (!functionName) return;
    await this.switchNetwork();

    const network = getNetwork();
    const walletClient = await getWalletClient({ chainId: network.chain?.id });

    const tx: any = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketAbi,
      functionName,
      args
    };
    if (value) tx.value = value;

    return await walletClient?.writeContract(tx);
  }

  async readContract(functionName: string, args: (string | undefined)[]): Promise<any> {
    const publicClient = getPublicClient();
    const call: any = await publicClient.readContract({
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketAbi,
      functionName,
      args,
    });
    return call;
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    const publicClient = getPublicClient();
    const transaction = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    return transaction;
  }

  async offerPhunkForSale(hashId: string, value: number, toAddress?: string | null): Promise<string | undefined> {
    // console.log('offerPhunkForSale', tokenId, value, toAddress);

    const weiValue = value * 1e18;
    if (toAddress) {
      if (!isAddress(toAddress)) throw new Error('Invalid address');
      return this.marketContractInteraction(
        'offerPhunkForSaleToAddress',
        [hashId, weiValue, toAddress]
      );
    }

    return this.marketContractInteraction(
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

    console.log({hashId, sig, bytes32Value, toAddress});

    return await this.batchTransferPhunks([hashId, sig, bytes32Value, toAddress], marketAddress);
  }

  async batchOfferPhunkForSale(hashIds: string[], listPrices: number[]): Promise<string | undefined> {
    const weiValues = listPrices.map((price) => BigInt(price * 1e18));
    return this.marketContractInteraction('batchOfferPhunkForSale', [hashIds, weiValues]);
  }

  async batchBuyPhunks(phunks: Phunk[]): Promise<string | undefined> {

    const walletClient = await getWalletClient();
    const address = walletClient?.account?.address as `0x${string}`;

    const hashIds = [];
    const minSalePricesInWei = [];

    let total = BigInt(0);
    for (const phunk of phunks) {
      if (!phunk.listing) continue;
      if (phunk.prevOwner?.toLowerCase() === address?.toLowerCase()) continue;

      hashIds.push(phunk.hashId);
      minSalePricesInWei.push(BigInt(phunk.listing.minValue));
      total += BigInt(phunk.listing.minValue);
    }

    console.log({hashIds, minSalePricesInWei, total});

    return this.marketContractInteraction(
      'batchBuyPhunk',
      [hashIds, minSalePricesInWei],
      total as any
    );
  }

  async phunkNoLongerForSale(hashId: string): Promise<string | undefined> {
    return this.marketContractInteraction('phunkNoLongerForSale', [hashId]);
  }

  async transferPhunk(hashId: string, toAddress: string): Promise<string | undefined> {
    if (!hashId) throw new Error('No phunk selected');
    if (!toAddress) throw new Error('No address provided');

    await this.switchNetwork();

    const wallet = await getWalletClient();
    return wallet?.sendTransaction({
      chain: getNetwork().chain,
      account: getAccount().address as `0x${string}`,
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

  async enterBidForPhunk(hashId: string, value: number): Promise<string | undefined> {
    const weiValue = this.ethToWei(value);
    return this.marketContractInteraction('enterBidForPhunk', [hashId], weiValue as any);
  }

  async withdrawBidForPhunk(hashId: string): Promise<string | undefined> {
    return this.marketContractInteraction('withdrawBidForPhunk', [hashId]);
  }

  async acceptBidForPhunk(hashId: string, minPrice: string): Promise<string | undefined> {
    // We need to make sure this get's added.
    // Once added, this loop will run through as mm knows it's on the network.
    // for (let i = 0; i < 11; i++) await this.addFlashbotsNetwork();

    return this.marketContractInteraction('acceptBidForPhunk', [hashId, minPrice]);
  }

  async buyPhunk(hashId: string, value: string): Promise<string | undefined> {
    return this.marketContractInteraction('buyPhunk', [hashId, value], value as any);
  }

  async withdraw(): Promise<any> {
    const hash = await this.marketContractInteraction('withdraw', []);
    const receipt = await this.waitForTransaction(hash!);
    return await this.checkHasWithdrawal(receipt.from);
  }

  async getUserPoints(address: string): Promise<number> {
    const publicClient = getPublicClient();
    const points = await publicClient?.readContract({
      address: pointsAddress as `0x${string}`,
      abi: PointsAbi,
      functionName: 'points',
      args: [address],
    });
    return Number(points);
  }

  async getMultiplier(): Promise<any> {
    const publicClient = getPublicClient();
    const multiplier = await publicClient?.readContract({
      address: pointsAddress as `0x${string}`,
      abi: PointsAbi,
      functionName: 'multiplier',
      args: [],
    });
    return multiplier;
  }

  //////////////////////////////////
  // TXNS //////////////////////////
  //////////////////////////////////

  async getTransaction(hash: string): Promise<any> {
    const publicClient = getPublicClient();
    const transaction = await publicClient?.getTransaction({ hash: hash as `0x${string}` });
    return transaction;
  }

  async getTransactionReceipt(hash: string): Promise<TransactionReceipt> {
    const publicClient = getPublicClient();
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

  //////////////////////////////////
  // UTILS /////////////////////////
  //////////////////////////////////

  async getCurrentBlock(): Promise<number> {
    const blockNum = await getPublicClient().getBlockNumber();
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
    return await getPublicClient().getEnsAddress({ name });
  }

  async getEnsFromAddress(address: string | null | undefined): Promise<string | null> {
    if (!address) return null;
    try {
      const ens = await getPublicClient().getEnsName({ address: address as `0x${string}` });
      return ens;
    } catch (err) {
      return null;
    }
  }

  checkNetwork(): number | undefined {
    const network = getNetwork();
    return network.chain?.id;
  }
}
