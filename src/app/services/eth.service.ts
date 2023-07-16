import { Injectable } from '@angular/core';

import { StateService } from './state.service';

import { Observable, catchError, filter, of, tap } from 'rxjs';

import { Address, FallbackTransport, TransactionReceipt, formatEther, isAddress, parseEther, toHex } from 'viem';
import { mainnet, goerli } from 'viem/chains';

import { Chain, Config, PublicClient, WebSocketPublicClient, configureChains, createConfig, disconnect, getAccount, getPublicClient, getWalletClient, switchNetwork, watchAccount } from '@wagmi/core';
import { jsonRpcProvider } from '@wagmi/core/providers/jsonRpc';

import { EthereumClient, w3mConnectors } from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/html';

import punkDataABI from '@/abi/PunkData.json';

import { environment } from 'src/environments/environment';

const projectId = 'd183619f342281fd3f3ff85716b6016a';

@Injectable({
  providedIn: 'root'
})

export class EthService {

  config!: Config<PublicClient<FallbackTransport, Chain>, WebSocketPublicClient<FallbackTransport, Chain>>;
  connectors: any[] = [];
  web3modal!: Web3Modal;

  web3Connecting: boolean = false;
  connectedState!: Observable<any>;

  constructor(
    private stateSvc: StateService
  ) {

    const { chains, publicClient, webSocketPublicClient } = configureChains(
      [mainnet, goerli],
      [
        jsonRpcProvider({
          rpc: (chain) => ({ http: environment.rpcUrl }),
        }),
      ],
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
        '--w3m-accent-color': 'rgba(var(--green), 1)',
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

  //////////////////////////////////
  // WALLET ////////////////////////
  //////////////////////////////////

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
  }

  async disconnectWeb3(): Promise<void> {
    if (getAccount().isConnected) {
      await disconnect();
      this.stateSvc.setWeb3Connected(false);
      this.stateSvc.setWalletAddress(null);
      this.setWalletAddress(null);
    }
  }

  setWalletAddress(address: any) {
    this.stateSvc.setWalletAddress(address);
  }

  //////////////////////////////////
  // TXNS //////////////////////////
  //////////////////////////////////

  async ethscribe(content: string | null): Promise<`0x${string}` | undefined> {
    if (!content) return;

    const walletClient = await getWalletClient();
    const data = toHex(content);

    const chainId = await walletClient?.getChainId();
    if (chainId !== environment.chainId) await switchNetwork({ chainId: environment.chainId });

    return await walletClient?.sendTransaction({
      chain: environment.production ? mainnet : goerli,
      to: this.stateSvc.getWalletAddress() as Address,
      value: BigInt(0),
      data,
    });
  }

  async transferEthPhunk(hashId: string, toAddress: string): Promise<`0x${string}` | undefined> {
    const walletClient = await getWalletClient();
    const chain = environment.production ? mainnet : goerli;

    const chainId = await walletClient?.getChainId();
    if (chainId !== environment.chainId) await switchNetwork({ chainId: environment.chainId });

    return await walletClient?.sendTransaction({
      chain,
      to: toAddress as `0x${string}`,
      value: BigInt(0),
      data: hashId as `0x${string}`,
    });
  }

  async waitForTransaction(hash: `0x${string}`): Promise<TransactionReceipt> {
    const publicClient = getPublicClient();
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async getTransaction(hash: string): Promise<any> {}

  //////////////////////////////////
  // PUNK STUFF ////////////////////
  //////////////////////////////////

  async getPunkImage(tokenId: string): Promise<any> {
    const publicClient = getPublicClient();

    const punkImage = await publicClient?.readContract({
      address: environment.punkDataAddress as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkImageSvg',
      args: [`${tokenId}`],
    });
    return punkImage as any;
  }

  async getPunkAttributes(tokenId: string): Promise<any> {
    const publicClient = getPublicClient();
    const punkAttributes = await publicClient?.readContract({
      address: environment.punkDataAddress as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkAttributes',
      args: [tokenId],
    });
    return punkAttributes as any;
  }

  async getCurrentBlock(): Promise<number> {
    const blockNum = await getPublicClient().getBlockNumber();
    return Number(blockNum);
  }

  //////////////////////////////////
  // UTILS /////////////////////////
  //////////////////////////////////

  ethToWei(eth: number): bigint {
    return parseEther(`${eth}`, 'wei');
  }

  weiToEth(wei: any): string {
    return formatEther(wei);
  }

  verifyAddress(address: string | null): string | null {
    if (!address) return null;
    const valid = isAddress(address);
    if (valid) return address.toLowerCase();
    return null;
  }

  //////////////////////////////////
  // ENS ///////////////////////////
  //////////////////////////////////

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

  async getActiveChain(): Promise<number> {
    const publicClient = getPublicClient();
    return publicClient.getChainId();
  }

}
