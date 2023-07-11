import { Injectable } from '@angular/core';

import { StateService } from './state.service';

import { Observable, catchError, filter, of, tap } from 'rxjs';

import { Address, FallbackTransport, TransactionReceipt, formatEther, isAddress, parseEther, stringToHex, toHex } from 'viem';
import { mainnet, goerli } from 'viem/chains';

import { Chain, Config, PublicClient, WebSocketPublicClient, configureChains, createConfig, disconnect, getAccount, getPublicClient, getWalletClient, watchAccount } from '@wagmi/core';

import { jsonRpcProvider } from '@wagmi/core/providers/jsonRpc';
import { EthereumClient, w3mConnectors } from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/html';

import punkDataABI from '@/abi/punkData.json';

const projectId = '9455b1a68e7f81eee6e1090c12edbf00';

const punkDataAddressMainnet = '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2';
const punkDataAddressGoerli = '0xd61Cb6E357bF34B9280d6cC6F7CCF1E66C2bcf89';

@Injectable({
  providedIn: 'root'
})

export class EthService {

  config!: Config<PublicClient<FallbackTransport, Chain>, WebSocketPublicClient<FallbackTransport, Chain>>;
  connectors: any[] = [];
  web3modal!: Web3Modal;

  web3Connecting: boolean = false;

  connectedState!: Observable<any>;

  phunk: any;

  constructor(
    private stateSvc: StateService
  ) {

    const { chains, publicClient, webSocketPublicClient } = configureChains(
      [
        mainnet,
        goerli
      ],
      [
        jsonRpcProvider({
          rpc: (chain) => ({ http: `http://${chain.id === 5 ? 'goerli-' : ''}geth.dappnode:8545` }),
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
        '--w3m-accent-color': 'rgba(var(--pink), 1)',
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

    // this.decodeInputData('0x8b72a2ec130c865fdc328a1a8319bd2e343695e09b46ca3aa14451377e8ca9192f7941ae00000000000000000000000000000000000000000000000000000000000013b1').then((data) => {
    //   console.log('decodeInputData', Number(data.args[1]));
    // });
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

  async getTransaction(hash: string): Promise<any> {}

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

  async getPunkImage(tokenId: string): Promise<any> {
    const publicClient = getPublicClient();
    const chainId = await publicClient?.getChainId();

    const punkImage = await publicClient?.readContract({
      address: chainId === 5 ? punkDataAddressGoerli : punkDataAddressMainnet as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkImageSvg',
      args: [`${tokenId}`],
    });
    return punkImage as any;
  }

  async getPunkAttributes(tokenId: string): Promise<any> {
    const publicClient = getPublicClient();
    const chainId = await publicClient?.getChainId();

    const punkAttributes = await publicClient?.readContract({
      address: chainId === 5 ? punkDataAddressGoerli : punkDataAddressMainnet as `0x${string}`,
      abi: punkDataABI,
      functionName: 'punkAttributes',
      args: [tokenId],
    });
    return punkAttributes as any;
  }

  async ethscribe(content: string | null): Promise<`0x${string}` | undefined> {
    if (!content) return;

    const walletClient = await getWalletClient();
    const chainId = await walletClient?.getChainId();
    const data = toHex(content);

    return await walletClient?.sendTransaction({
      chain: chainId === 5 ? goerli : mainnet,
      to: this.stateSvc.getWalletAddress() as Address,
      value: BigInt(0),
      data,
    });
  }

  async waitForTransaction(hash: `0x${string}`): Promise<TransactionReceipt> {
    const publicClient = getPublicClient();
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async getActiveChain(): Promise<number> {
    const publicClient = getPublicClient();
    return publicClient.getChainId();
  }

}
