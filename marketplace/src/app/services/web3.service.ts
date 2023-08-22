import { Injectable } from '@angular/core';

import { environment } from 'src/environments/environment';

import { StateService } from './state.service';
import { DataService } from './data.service';

import { Observable, catchError, filter, firstValueFrom, of, tap } from 'rxjs';

import CryptoPunksMarketABI from '@/abi/CryptoPunksMarket.json';

import { FallbackTransport, TransactionReceipt, createWalletClient, custom, decodeFunctionData, formatEther, formatUnits, isAddress, parseEther } from 'viem';
import { mainnet, goerli } from 'viem/chains';

import { Chain, Config, PublicClient, WebSocketPublicClient, configureChains, createConfig, disconnect, getAccount, getNetwork, getPublicClient, getWalletClient, readContract, watchAccount } from '@wagmi/core';

import { alchemyProvider } from '@wagmi/core/providers/alchemy';
import { EthereumClient, w3mConnectors } from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/html';

const marketAddress = environment.punksMarketAddress;
const cigAddress = environment.cigAddress;

const projectId = '9455b1a68e7f81eee6e1090c12edbf00';

@Injectable({
  providedIn: 'root'
})

export class Web3Service {

  config!: Config<PublicClient<FallbackTransport, Chain>, WebSocketPublicClient<FallbackTransport, Chain>>;
  connectors: any[] = [];
  web3modal!: Web3Modal;

  web3Connecting: boolean = false;

  connectedState!: Observable<any>;

  constructor(
    private stateSvc: StateService,
    private dataSvc: DataService
  ) {

    const { chains, publicClient, webSocketPublicClient } = configureChains(
      [mainnet, goerli],
      [alchemyProvider({ apiKey: environment.alchemyApiKey })],
    );

    this.connectors = [ ...w3mConnectors({ projectId, chains }) ];

    this.config = createConfig({
      autoConnect: true,
      publicClient,
      webSocketPublicClient,
      connectors: this.connectors
    });

    const ethereumClient = new EthereumClient(this.config, chains);
    this.web3modal = new Web3Modal({
      projectId,
      themeVariables: {
        '--w3m-font-family': 'Montserrat, sans-serif',
        '--w3m-accent-color': 'rgba(var(--highlight), 1)',
        '--w3m-accent-fill-color': 'rgba(var(--text-color), 1)',
        '--w3m-background-color': 'rgba(var(--background), 1)',
        '--w3m-overlay-background-color': 'rgba(var(--background), .5)',
        '--w3m-z-index': '2000',
        '--w3m-wallet-icon-border-radius': '0',
        '--w3m-background-border-radius': '0',
        '--w3m-button-border-radius': '0',
        '--w3m-button-hover-highlight-border-radius': '0',
        '--w3m-container-border-radius': '0',
        '--w3m-icon-button-border-radius': '0',
        '--w3m-secondary-button-border-radius': '0',
      }
    }, ethereumClient);

    this.createListeners();
  }

  createListeners(): void {
    this.connectedState = new Observable((observer) => watchAccount((account) => observer.next(account)));
    this.connectedState.pipe(
      // tap((account: GetAccountResult<PublicClient>) => console.log(account)),
      tap((account) => { if (account.isDisconnected) this.disconnectWeb3(); }),
      filter((account) => account.isConnected),
      tap((account) => this.connectWeb3(account.address as string)),
      catchError((err) => {
        this.disconnectWeb3();
        return of(err);
      }),
    ).subscribe();
  }

  async connect(): Promise<void> {
    try {
      await this.web3modal.openModal();
    } catch (error) {
      console.log(error);
      this.disconnectWeb3();
    }
  }

  async connectWeb3(address: string): Promise<void> {
    if (!address) return;
    address = address.toLowerCase();

    this.stateSvc.setWeb3Connected(true);
    this.setWalletAddress(address);
    this.checkHasWithdrawal(address);
  }

  async disconnectWeb3(): Promise<void> {
    if (getAccount().isConnected) {
      await disconnect();
      this.stateSvc.setWeb3Connected(false);
      this.stateSvc.setWalletAddress(null);
      this.stateSvc.setCigBalances(null);
      this.setWalletAddress(null);
    }
  }

  async checkHasWithdrawal(address: string): Promise<void> {
    const publicClient = getPublicClient();
    const pendingWithdrawals = await publicClient?.readContract({
      address: marketAddress as `0x${string}`,
      abi: CryptoPunksMarketABI,
      functionName: 'pendingWithdrawals',
      args: [address],
    });

    this.stateSvc.setHasWithdrawal(!!pendingWithdrawals);
  }

  setWalletAddress(address: any) {
    this.stateSvc.setWalletAddress(address);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CONTRACT METHODS //////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async decodeInputData(data: string): Promise<any> {
    const decoded = decodeFunctionData({
      abi: CryptoPunksMarketABI,
      data: data as `0x${string}`,
    });
    return decoded;
  }

  async punkContractInteraction(functionName: string, args: any[], value?: string): Promise<string | undefined> {
    if (!functionName) return;

    const network = getNetwork();
    const walletClient = await getWalletClient({ chainId: network.chain?.id });

    const tx: any = {
      address: marketAddress as `0x${string}`,
      abi: CryptoPunksMarketABI,
      functionName,
      args
    };
    if (value) tx.value = value;

    return await walletClient?.writeContract(tx);
  }

  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    const publicClient = getPublicClient();
    const transaction = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    return transaction;
  }

  async offerPunkForSale(tokenId: string, value: number, toAddress?: string | null): Promise<string | undefined> {
    // console.log('offerPunkForSale', tokenId, value, toAddress);

    const weiValue = this.ethToWei(value);
    if (toAddress) {
      if (!isAddress(toAddress)) throw new Error('Invalid address');
      return this.punkContractInteraction(
        'offerPunkForSaleToAddress',
        [tokenId, weiValue, toAddress]
      );
    }
    return this.punkContractInteraction('offerPunkForSale', [tokenId, weiValue]);
  }

  async punkNoLongerForSale(tokenId: string): Promise<string | undefined> {
    return this.punkContractInteraction('punkNoLongerForSale', [tokenId]);
  }

  async transferPunk(hashId: string, toAddress: string): Promise<string | undefined> {
    const wallet = await getWalletClient();

    return wallet?.sendTransaction({
      chain: getNetwork().chain,
      account: getAccount().address as `0x${string}`,
      to: toAddress as `0x${string}`,
      value: BigInt(0),
      data: hashId as `0x${string}`,
    });
  }

  async enterBidForPunk(tokenId: string, value: number): Promise<string | undefined> {
    const weiValue = this.ethToWei(value);
    return this.punkContractInteraction('enterBidForPunk', [tokenId], weiValue as any);
  }

  async withdrawBidForPunk(tokenId: string): Promise<string | undefined> {
    return this.punkContractInteraction('withdrawBidForPunk', [tokenId]);
  }

  async acceptBidForPunk(tokenId: string, minPrice: string): Promise<string | undefined> {
    // We need to make sure this get's added.
    // Once added, this loop will run through as mm knows it's on the network.
    for (let i = 0; i < 11; i++) await this.addFlashbotsNetwork();

    return this.punkContractInteraction('acceptBidForPunk', [tokenId, minPrice]);
  }

  async buyPunk(tokenId: string, value: string): Promise<string | undefined> {
    return this.punkContractInteraction('buyPunk', [tokenId], value as any);
  }

  async withdraw(): Promise<any> {
    const hash = await this.punkContractInteraction('withdraw', []);
    const receipt = await this.waitForTransaction(hash!);
    return await this.checkHasWithdrawal(receipt.from);
  }

  //////////////////////////////////
  // TXNS //////////////////////////
  //////////////////////////////////

  async getTransaction(hash: string): Promise<any> {}

  // ///////////////////////////////
  // NETWORKS //////////////////////
  //////////////////////////////////

  async addFlashbotsNetwork(): Promise<void> {

    const network = getNetwork();
    const id = network.chain?.id;
    const networks: any = { 1: 'mainnet', 5: 'goerli' };

    const flashbotsProtectRPC: Chain = {
      id: id!,
      name: 'Flashbots Protect RPC',
      network: networks[id!],
      nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
      },
      rpcUrls: {
        public: { http: [`https://rpc${id === 5 ? '-goerli' : ''}.flashbots.net?hint=hash`] },
        default: { http: [`https://rpc${id === 5 ? '-goerli' : ''}.flashbots.net?hint=hash`] },
      },
      blockExplorers: {
        etherscan: { name: 'Etherscan', url: `https://${id === 5 ? 'goerli.' : ''}etherscan.io` },
        default: { name: 'Etherscan', url: `https://${id === 5 ? 'goerli.' : ''}etherscan.io` },
      },
    };

    const walletClient = createWalletClient({
      chain: flashbotsProtectRPC,
      transport: custom((window as any).ethereum)
    });

    return walletClient.addChain({ chain: flashbotsProtectRPC });
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
}
