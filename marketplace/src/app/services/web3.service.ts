import { Injectable, NgZone } from '@angular/core';

import { Store } from '@ngrx/store';

import { GlobalState } from '@/models/global-state';
import { Auction, Phunk } from '@/models/db';
import { AuctionRequest, formatAuction, isValidAuction } from '@/models/auctions';

import { Observable, catchError, firstValueFrom, interval, from, of, tap, switchMap, merge } from 'rxjs';

import { AppKit, createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { AppKitNetwork, mainnet, sepolia } from '@reown/appkit/networks'

import { getBlockNumber, getEnsAddress, getEnsAvatar, getEnsName, getTransaction, getTransactionReceipt, multicall, readContract, simulateContract, watchBlockNumber, watchContractEvent } from 'viem/actions';
import { Client, TransactionReceipt, WatchBlockNumberReturnType, WatchContractEventReturnType, bytesToHex, decodeFunctionData, formatEther, isAddress, keccak256, numberToBytes, parseEther, stringToBytes, toHex, zeroAddress, http } from 'viem';

import { reconnect, Config, watchAccount, getPublicClient, getAccount, disconnect, getChainId, getWalletClient, GetWalletClientReturnType, GetAccountReturnType, signTypedData } from '@wagmi/core';

// L1
import { EtherPhunksMarketABI } from '@/abi/EtherPhunksMarket';
import { PointsABI } from '@/abi/Points';
import { auctionHouseL1 } from '@/abi/AuctionHouseL1';

// L2
import { EtherPhunksNftMarketABI } from '@/abi/EtherPhunksNftMarket';
import { EtherPhunksBridgeL2ABI } from '@/abi/EtherPhunksBridgeL2';

import * as appStateActions from '@/state/app/app-state.actions';

import { selectIsBanned } from '@/state/app/app-state.selectors';

import { environment } from '@environments/environment';

const marketAddress = environment.marketAddress;
const marketAddressL2 = environment.marketAddressL2;
const pointsAddress = environment.pointsAddress;
const bridgeAddressL2 = environment.bridgeAddressL2;
const auctionHouseAddress = environment.auctionHouseAddress;

const projectId = 'd183619f342281fd3f3ff85716b6016a';

const metadata = {
  name: 'Ethereum Phunks Market',
  description: 'A decentralized marketplace for Ethereum Phunks & Curated Ethscription Collections',
  url: 'https://etherphunks.eth.limo',
  icons: ['https://etherphunks.eth.limo/favicon.ico']
};

const themeVariables = {
  '--w3m-font-family': 'Montserrat, sans-serif',
  '--w3m-accent': 'rgba(var(--highlight), 1)',
  '--w3m-z-index': 9999999999999,
  '--w3m-border-radius-master': '0',
};

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  minCooldown = 4;
  connectedState$!: Observable<GetAccountReturnType<Config>>;

  l1Client!: Client;
  l2Client!: Client;

  config!: Config;
  modal!: AppKit;
  wagmiAdapter!: WagmiAdapter;
  networks: [AppKitNetwork, ...AppKitNetwork[]] = environment.chainId === 1 ? [mainnet] : [sepolia];

  globalConfig$ = this.store.select(state => state.appState.config);

  constructor(
    private store: Store<GlobalState>,
    private ngZone: NgZone
  ) {

    this.wagmiAdapter = new WagmiAdapter({
      projectId,
      networks: this.networks,
      transports: {
        [mainnet.id]: http(environment.rpcHttpProvider),
        [sepolia.id]: http(environment.rpcHttpProvider),
      }
    });

    this.modal = createAppKit({
      adapters: [this.wagmiAdapter],
      networks: this.networks,
      metadata,
      themeVariables,
      projectId,
      enableNetworkSwitch: false,
      enableWalletGuide: false,
      allWallets: "ONLY_MOBILE",
      features: {
        analytics: false
      }
    });

    this.config = this.wagmiAdapter.wagmiConfig;
    this.l1Client = this.config.getClient();
    this.l2Client = this.config.getClient();

    this.createListeners();
    this.startBlockWatcher();
    this.startPointsWatcher();
  }

  /**
   * Opens the Web3Modal for wallet connection
   * @throws Error if connection fails
   */
  async connect(): Promise<void> {
    try {
      await this.modal.open({ view: 'Connect' });
    } catch (error) {
      console.log(error);
      this.disconnectWeb3();
    }
  }

  /**
   * Disconnects the currently connected Web3 wallet
   * Clears wallet address and connection state from store
   */
  async disconnectWeb3(): Promise<void> {
    if (getAccount(this.config).isConnected) {
      await disconnect(this.config);
      this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: undefined }));
      this.store.dispatch(appStateActions.setConnected({ connected: false }));
    }
  }

  /**
   * Creates and initializes Web3 event listeners for account changes and blockchain events
   * @returns Promise that resolves when listeners are set up
   */
  async createListeners(): Promise<void> {

    this.connectedState$ = new Observable((observer) => watchAccount(this.config, {
      onChange: (account) => this.ngZone.run(() => observer.next(account))
    }));

    this.connectedState$.pipe(
      tap((account: GetAccountReturnType) => {
        this.store.dispatch(appStateActions.setConnected({ connected: account.isConnected }));
        this.store.dispatch(appStateActions.setWalletAddress({ walletAddress: account.address?.toLowerCase() }));
        // if (account.chainId !== environment.chainId) this.switchNetwork();
      }),
      catchError((err) => {
        this.disconnectWeb3();
        return of(err);
      }),
    ).subscribe();

    await reconnect(this.config);
  }

  /**
   * Starts watching for new blocks on the L1 chain
   * Updates the current block number in the store when new blocks arrive
   */
  blockWatcher!: WatchBlockNumberReturnType | undefined;
  startBlockWatcher(): void {
    if (this.blockWatcher) return;
    this.blockWatcher = watchBlockNumber(this.l1Client, {
      emitOnBegin: true,
      onBlockNumber: (blockNumber) => {
        const currentBlock = Number(blockNumber);
        this.store.dispatch(appStateActions.setCurrentBlock({ currentBlock }));
      }
    });
  }

  /**
   * Starts watching for points-related events from the Points contract
   * Dispatches store actions when points are added or multipliers change
   */
  pointsWatcher!: WatchContractEventReturnType | undefined;
  startPointsWatcher(): void {
    if (this.pointsWatcher) return;
    this.pointsWatcher = watchContractEvent(this.l1Client, {
      address: pointsAddress as `0x${string}`,
      abi: PointsABI,
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          if (log.eventName === 'PointsAdded') this.store.dispatch(appStateActions.pointsChanged({ log }));
          // TODO: Add event to smart contract
          if (log.eventName === 'MultiplierSet') {}
        });
      }
    });
  }

  /**
   * Switches the connected wallet to the specified network
   * @param l Network to switch to - 'l1' for mainnet/testnet or 'l2' for Magma
   */
  async switchNetwork(l: 'l1' | 'l2' = 'l1'): Promise<void> {
    const walletClient = await getWalletClient(this.config);
    const chainId = getChainId(this.config);

    if (l === 'l1') {
      if (chainId === environment.chainId) return;
      console.log('switching chain', chainId, environment.chainId);
      return await walletClient?.switchChain({ id: environment.chainId });
    } else if (l === 'l2') {
      // if (chainId === magma.id) return;
      // return await walletClient?.switchChain({ id: magma.id });
    }
  }

  /**
   * Gets the active wallet client
   * @returns Promise resolving to the wallet client instance
   */
  async getActiveWalletClient(): Promise<GetWalletClientReturnType> {
    return await getWalletClient(this.config);
  }

  /**
   * Checks if an address has any pending withdrawals
   * @param address The address to check for withdrawals
   * @returns Promise resolving to the total pending withdrawal amount as a bigint
   */
  async checkHasWithdrawal(address: string): Promise<bigint> {
    const pendingWithdrawals = await this.readMarketContract('pendingWithdrawals', [address]);
    // const pendingWithdrawalsV2 = await this.readMarketContract('pendingWithdrawalsV2', [address]);
    // console.log(pendingWithdrawals || BigInt(0)) + (pendingWithdrawalsV2 || BigInt(0));
    return pendingWithdrawals || BigInt(0);
  }

  /**
   * Checks if the marketplace contract is currently paused
   * @returns Promise resolving to true if paused, false otherwise
   */
  async checkContractPaused(): Promise<boolean> {
    const paused = await this.readMarketContract('paused', []);
    return paused;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // L1 CONTRACT METHODS ///////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Checks if a token is currently in escrow
   * @param tokenId The token ID to check
   * @returns Promise resolving to true if token is in escrow, false otherwise
   */
  async isInEscrow(tokenId: string): Promise<boolean> {
    const address = getAccount(this.config).address;
    if (!address) return false;

    const isInEscrow = await this.readMarketContract('userEthscriptionPossiblyStored', [address, tokenId]);
    return !!isInEscrow;
  }

  /**
   * Sends an ethscription to the marketplace contract
   * @param tokenId The token ID to send
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if token is already in escrow
   */
  async sendEthscriptionToContract(tokenId: string): Promise<string | undefined> {
    const escrowed = await this.isInEscrow(tokenId);
    if (escrowed) throw new Error('Phunk already in escrow');
    return await this.transferPhunk(tokenId, marketAddress as `0x${string}`);
  }

  /**
   * Sends a phunk to the auction contract
   * @param hashId The hash ID of the phunk to send
   * @param duration The duration of the auction
   * @param minBidIncrementPercentage The minimum bid increment percentage
   * @param timeBuffer The time buffer
   * @returns Promise resolving to the transaction hash if successful
   */
  async sendToAuction(
    hashId: string,
    duration: number,
    minBidIncrementPercentage: number,
    timeBuffer: number
  ): Promise<string | undefined> {
    const sig = keccak256(stringToBytes('DEPOSIT_AND_AUCTION_SIGNATURE'));

    const durationHex = bytesToHex(numberToBytes(duration, { size: 32 }));
    const minBidIncrementPercentageHex = bytesToHex(numberToBytes(minBidIncrementPercentage, { size: 32 }));
    const timeBufferHex = bytesToHex(numberToBytes(timeBuffer, { size: 32 }));

    return await this.batchTransferPhunks([hashId, sig, durationHex, minBidIncrementPercentageHex, timeBufferHex], auctionHouseAddress);
  }

  /**
   * Creates a bid on an auction
   * @param bidValue The bid value in ETH
   * @param hashId The hash ID of the phunk to bid on
   * @param prevOwner The previous owner of the phunk
   * @returns Promise resolving to the transaction hash if successful
   */
  async createBid(
    bidValue: number,
    hashId: string,
    prevOwner: string
  ): Promise<string | undefined> {
    const weiValue = this.ethToWei(bidValue);
    return await this.writeAuctionContract('createBid', [hashId, prevOwner], weiValue.toString());
  }

  /**
   * Settles an auction
   * @param hashId The hash ID of the phunk to settle
   * @param prevOwner The previous owner of the phunk
   * @returns Promise resolving to the transaction hash if successful
   */
  async settleAuction(
    hashId: string,
    prevOwner: string
  ): Promise<string | undefined> {
    return await this.writeAuctionContract('settleAuction', [hashId, prevOwner]);
  }

  /**
   * Watches an auction by previous owner and hash ID
   * @param prevOwner The previous owner of the phunk
   * @param hashId The hash ID of the phunk to watch
   * @returns Observable resolving to the auction result
   */
  watchAuctionByPrevOwnerAndHashId({
    prevOwner,
    hashId
  }: AuctionRequest): Observable<Auction | null> {
    const fetchAuction = () => from(this.getAuctionByPrevOwnerAndHashId({ prevOwner, hashId }));

    return merge(
      fetchAuction(), // Initial value
      interval(5000).pipe(
        switchMap(() => fetchAuction()) // Periodic updates
      )
    );
  }

  /**
   * Gets an auction by previous owner and hash ID
   * @param prevOwner The previous owner of the phunk
   * @param hashId The hash ID of the phunk to get
   * @returns Promise resolving to the auction result or null if not found
   */
  async getAuctionByPrevOwnerAndHashId({
    prevOwner,
    hashId
  }: AuctionRequest): Promise<Auction | null> {
    const result = await this.readAuctionContract('getAuction', [prevOwner, hashId]);
    if (!result) return null;

    const formatted = formatAuction(result);
    const isValid = isValidAuction(formatted);
    if (!isValid) return null;

    return formatted;
  }

  /**
   * Withdraws a phunk from escrow
   * @param hashId The hash ID of the phunk to withdraw
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if phunk is not in escrow
   */
  async withdrawPhunk(hashId: string): Promise<string | undefined> {
    const escrowed = await this.isInEscrow(hashId);
    if (!escrowed) throw new Error('Phunk not in escrow');
    return await this.writeMarketContract('withdrawPhunk', [hashId]);
  }

  /**
   * Withdraws multiple phunks from escrow in a single transaction
   * @param hashIds Array of hash IDs to withdraw
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if no phunks are selected
   */
  async withdrawBatch(hashIds: string[]): Promise<string | undefined> {
    if (!hashIds.length) throw new Error('No phunks selected');
    return await this.writeMarketContract('withdrawBatchPhunks', [hashIds]);
  }

  /**
   * Decodes input data from a transaction
   * @param data The transaction input data to decode
   * @returns Promise resolving to the decoded function data
   */
  async decodeInputData(data: string): Promise<any> {
    const decoded = decodeFunctionData({
      abi: EtherPhunksMarketABI,
      data: data as `0x${string}`,
    });
    return decoded;
  }

  /**
   * Executes a write operation on the marketplace contract
   * @param functionName The name of the function to call
   * @param args The arguments to pass to the function
   * @param value Optional value in wei to send with the transaction
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if no public client or in maintenance mode
   */
  async writeMarketContract(
    functionName: string,
    args: any[],
    value?: string
  ): Promise<string | undefined> {
    if (!functionName) return;
    await this.switchNetwork();

    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });
    const publicClient = getPublicClient(this.config, { chainId });

    if (!publicClient) throw new Error('No public client');

    const { maintenance } = await firstValueFrom(this.globalConfig$);
    if (maintenance && environment.production) throw new Error('In maintenance mode');

    const tx: any = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI,
      functionName,
      args,
      account: walletClient?.account?.address as `0x${string}`,
    };
    if (value) tx.value = value;

    const { request, result } = await publicClient.simulateContract(tx);
    return await walletClient?.writeContract(request);
  }

  /**
   * Reads data from the marketplace contract
   * @param functionName The name of the function to call
   * @param args The arguments to pass to the function
   * @returns Promise resolving to the function result or null if error
   */
  async readMarketContract(functionName: any, args: (string | undefined)[]): Promise<any | null> {
    try {
      const call: any = await readContract(this.l1Client, {
        address: marketAddress as `0x${string}`,
        abi: EtherPhunksMarketABI,
        functionName,
        args: args as any,
      });
      return call;
    } catch (error) {
      console.log({functionName, args, error});
      return null;
    }
  }

  async writeAuctionContract(
    functionName: any,
    args: (string | undefined)[],
    value?: string
  ): Promise<any | null> {
    if (!functionName) return;
    await this.switchNetwork();

    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });
    const publicClient = getPublicClient(this.config, { chainId });

    if (!publicClient) throw new Error('No public client');

    const { maintenance } = await firstValueFrom(this.globalConfig$);
    if (maintenance && environment.production) throw new Error('In maintenance mode');

    const tx: any = {
      address: auctionHouseAddress as `0x${string}`,
      abi: auctionHouseL1,
      functionName,
      args,
      account: walletClient?.account?.address as `0x${string}`,
      value: value || '0',
    };

    const { request, result } = await publicClient.simulateContract(tx);
    return await walletClient?.writeContract(request);
  }

  async readAuctionContract(functionName: any, args: (string | undefined)[]): Promise<any | null> {
    try {
      const call = await readContract(this.l1Client, {
        address: auctionHouseAddress as `0x${string}`,
        abi: auctionHouseL1,
        functionName,
        args: args as any,
      });
      return call;
    } catch (error) {
      console.log({functionName, args, error});
      return null;
    }
  }

  /**
   * Waits for a transaction to be mined and returns the receipt
   * @param hash The transaction hash to wait for
   * @returns Promise resolving to the transaction receipt
   * @throws Error if no public client
   */
  async waitForTransaction(hash: string): Promise<TransactionReceipt> {
    const chainId = getChainId(this.config);
    const publicClient = getPublicClient(this.config, { chainId });
    if (!publicClient) throw new Error('No public client');
    const transaction = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    return transaction;
  }

  /**
   * Lists a phunk for sale
   * @param hashId The hash ID of the phunk to list
   * @param value The price in ETH
   * @param toAddress Optional specific address that can buy the phunk
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if toAddress is invalid
   */
  async offerPhunkForSale(
    hashId: string,
    value: number,
    toAddress?: string | null,
    // revShare = 0
  ): Promise<string | undefined> {
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

  /**
   * Escrows and lists a phunk for sale in one transaction
   * @param hashId The hash ID of the phunk
   * @param value The price in ETH
   * @param toAddress The address that can buy the phunk (defaults to zero address)
   * @returns Promise resolving to the transaction hash if successful
   */
  async escrowAndOfferPhunkForSale(
    hashId: string,
    value: number,
    toAddress: string = zeroAddress,
    // revShare = 0
  ): Promise<string | undefined> {
    const weiValue = this.ethToWei(value);

    const sig = keccak256(stringToBytes('DEPOSIT_AND_LIST_SIGNATURE'));
    const bytes32Value = weiValue.toString(16).padStart(64, '0');
    toAddress = toAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    // const revShareHex = numberToHex(revShare).replace('0x', '').padStart(64, '0');

    return await this.batchTransferPhunks([hashId, sig, bytes32Value, toAddress], marketAddress);
  }

  /**
   * Lists multiple phunks for sale in one transaction
   * @param hashIds Array of hash IDs to list
   * @param listPrices Array of prices in ETH corresponding to each hash ID
   * @returns Promise resolving to the transaction hash if successful
   */
  async batchOfferPhunkForSale(hashIds: string[], listPrices: number[]): Promise<string | undefined> {
    const weiValues = listPrices.map((price) => this.ethToWei(price));
    return this.writeMarketContract('batchOfferPhunkForSale', [hashIds, weiValues]);
  }

  /**
   * Buys multiple phunks in one transaction
   * @param phunks Array of Phunk objects to buy
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if user is banned or no phunks are selected
   */
  async batchBuyPhunks(
    phunks: Phunk[]
  ): Promise<string | undefined> {
    const address = getAccount(this.config).address;
    const escrowAndListing = await this.fetchMultipleEscrowAndListing(phunks);

    const hashIds = [];
    const minSalePricesInWei = [];

    let total = BigInt(0);

    if (environment.chainId === 11155111) {
      const isBanned = await firstValueFrom(this.store.select(selectIsBanned));
      if (isBanned) throw new Error('User is banned from buying');
    }

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

    return this.writeMarketContract(
      'batchBuyPhunk',
      [hashIds, minSalePricesInWei],
      total as any
    );
  }

  /**
   * Cancels a phunk listing
   * @param hashId The hash ID of the phunk to delist
   * @returns Promise resolving to the transaction hash if successful
   */
  async phunkNoLongerForSale(hashId: string): Promise<string | undefined> {
    return this.writeMarketContract('phunkNoLongerForSale', [hashId]);
  }

  /**
   * Transfers a phunk to another address
   * @param hashId The hash ID of the phunk to transfer
   * @param toAddress The recipient address
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if no phunk selected or no address provided
   */
  async transferPhunk(hashId: string, toAddress: string): Promise<string | undefined> {
    if (!hashId) throw new Error('No phunk selected');
    if (!toAddress) throw new Error('No address provided');

    await this.switchNetwork();

    const wallet = await getWalletClient(this.config);
    const req = await wallet.prepareTransactionRequest({
      chain: wallet.chain,
      account: getAccount(this.config).address as `0x${string}`,
      to: toAddress as `0x${string}`,
      value: BigInt(0),
      data: hashId as `0x${string}`,
    });

    return wallet?.sendTransaction(req);
  }

  /**
   * Transfers multiple phunks in one transaction
   * @param hashIds Array of hash IDs to transfer
   * @param toAddress The recipient address
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if no phunks selected or no address provided
   */
  async batchTransferPhunks(hashIds: string[], toAddress: string | null): Promise<string | undefined> {
    if (!hashIds.length) throw new Error('No phunks selected');
    if (!toAddress) throw new Error('No address provided');
    const hash = hashIds.map((res) => res.replace('0x', '')).join('');
    return await this.transferPhunk(`0x${hash}`, toAddress);
  }

  /**
   * Locks a phunk in the bridge contract
   * @param hexArr Array of hex values for the lock transaction
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if no phunk selected
   */
  async lockPhunk(hexArr: string[]): Promise<string | undefined> {
    if (!hexArr.length) throw new Error('No phunk selected');
    await this.switchNetwork();

    const data = hexArr.map((res) => res.replace('0x', '')).join('');

    const wallet = await getWalletClient(this.config);

    const req = await wallet.prepareTransactionRequest({
      chain: wallet.chain,
      account: getAccount(this.config).address as `0x${string}`,
      to: environment.bridgeAddress as `0x${string}`,
      value: BigInt(1000000000000000),
      data: `0x${data}` as `0x${string}`,
    });

    // console.log({req});

    return wallet?.sendTransaction(req);
  }

  /**
   * Withdraws accumulated ETH from sales
   * @returns Promise resolving to the remaining withdrawal balance
   */
  async withdraw(): Promise<any> {
    const hash = await this.writeMarketContract('withdraw', []);
    const receipt = await this.waitForTransaction(hash!);
    return await this.checkHasWithdrawal(receipt.from);
  }

  /**
   * Gets the points balance for a user
   * @param address The address to check points for
   * @returns Promise resolving to the points balance as a number
   */
  async getUserPoints(address: string): Promise<number> {
    const points = await readContract(this.l1Client, {
      address: pointsAddress as `0x${string}`,
      abi: PointsABI,
      functionName: 'points',
      args: [address as `0x${string}`],
    });
    return Number(points);
  }

  /**
   * Gets the current points multiplier
   * @returns Promise resolving to the current multiplier value
   */
  async getMultiplier(): Promise<any> {
    const multiplier = await readContract(this.l1Client, {
      address: pointsAddress as `0x${string}`,
      abi: PointsABI,
      functionName: 'multiplier',
      args: [],
    });
    return multiplier;
  }

  /**
   * Fetches on-chain escrow and listing information for a given previous owner and hash ID.
   * @param prevOwner The previous owner's address.
   * @param hashId The hash ID of the item.
   * @returns Promise resolving to the escrow and listing information.
   */
  async fetchEscrowAndListing(prevOwner: string, hashId: string): Promise<any> {
    const contract = {
      address: marketAddress as `0x${string}`,
      abi: EtherPhunksMarketABI as any
    };

    const call = await multicall(this.l1Client, {
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
    return call;
  }

  /**
   * Fetches multiple on-chain escrow and listing information for an array of Phunks.
   * @param phunks - An array of Phunks for which to fetch the information.
   * @returns Promise resolving to an object containing the combined escrow and listing information.
   */
  async fetchMultipleEscrowAndListing(phunks: Phunk[]): Promise<any> {
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

    const res = await multicall(this.l1Client, { contracts: calls });

    // console.log({res})

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

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // L2 CONTRACT METHODS ///////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Fetches the sale offer details for a phunk on L2
   * @param hashId The hash ID of the phunk to check
   * @returns Promise resolving to the offer details, or null if error
   */
  async phunksOfferedForSaleL2(hashId: string): Promise<any> {
    try {
      const tokenId = await this.readTokenContractL2('hashToToken', [hashId]);
      const offer = await this.readMarketContractL2('phunksOfferedForSale', [tokenId]);
      return offer;
    } catch (error) {
      console.log('phunksOfferedForSaleL2', {hashId, error});
      return null;
    }
  }

  /**
   * Lists a phunk for sale on L2
   * @param hashId The hash ID of the phunk to list
   * @param value The sale price in ETH
   * @param address Optional specific address to sell to
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if address is invalid
   */
  async offerPhunkForSaleL2(
    hashId: string,
    value: number,
    address?: string,
    // revShare = 0
  ): Promise<string | undefined> {
    const tokenId = await this.readTokenContractL2('hashToToken', [hashId]);
    const weiValue = this.ethToWei(value);

    const isApproved = await this.readTokenContractL2(
      'isApprovedForAll',
      [getAccount(this.config).address, marketAddressL2]
    );

    if (!isApproved) {
      await this.writeTokenContractL2('setApprovalForAll', [marketAddressL2, true]);
    }

    if (address) {
      if (!isAddress(address)) throw new Error('Invalid address');
      return this.writeMarketContractL2('offerPhunkForSaleToAddress', [tokenId, weiValue, address]);
    } else {
      return this.writeMarketContractL2('offerPhunkForSale', [tokenId, weiValue]);
    }
  }

  /**
   * Purchases a phunk listed for sale on L2
   * @param hashId The hash ID of the phunk to buy
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if phunk is not for sale
   */
  async buyPhunkL2(hashId: string): Promise<string | undefined> {
    const tokenId = await this.readTokenContractL2('hashToToken', [hashId]);
    const offer = await this.readMarketContractL2('phunksOfferedForSale', [tokenId]);

    // console.log({tokenId, offer});
    if (!offer[0]) throw new Error('Phunk not for sale');

    const value = offer[3];
    await this.switchNetwork('l2');
    return this.writeMarketContractL2('buyPhunk', [tokenId], value);
  }

  /**
   * Cancels a phunk listing on L2
   * @param hashId The hash ID of the phunk listing to cancel
   * @returns Promise resolving to the transaction hash if successful
   */
  async phunkNoLongerForSaleL2(hashId: string): Promise<string | undefined> {
    const tokenId = await this.readTokenContractL2('hashToToken', [hashId]);
    return this.writeMarketContractL2('phunkNoLongerForSale', [tokenId]);
  }

  /**
   * Executes a write operation on the L2 marketplace contract
   * @param functionName The name of the contract function to call
   * @param args The arguments to pass to the function
   * @param value Optional value in wei to send with the transaction
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if contract is paused or in maintenance mode
   */
  async writeMarketContractL2(
    functionName: string,
    args: any[],
    value?: string
  ): Promise<string | undefined> {
    if (!functionName) return;
    await this.switchNetwork('l2');

    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });

    const paused = await this.readMarketContractL2('paused', []);
    const { maintenance } = await firstValueFrom(this.globalConfig$);

    if (paused) throw new Error('Contract is paused');
    if (maintenance) throw new Error('In maintenance mode');

    const tx: any = {
      address: marketAddressL2 as `0x${string}`,
      abi: EtherPhunksNftMarketABI,
      functionName,
      args,
      account: walletClient?.account?.address as `0x${string}`,
    };
    if (value) tx.value = value;

    const { request, result } = await simulateContract(this.l2Client, tx);
    return await walletClient?.writeContract(request);
  }

  /**
   * Executes a write operation on the L2 token contract
   * @param functionName The name of the contract function to call
   * @param args The arguments to pass to the function
   * @param value Optional value in wei to send with the transaction
   * @returns Promise resolving to the transaction hash if successful
   * @throws Error if contract is paused or in maintenance mode
   */
  async writeTokenContractL2(
    functionName: string,
    args: any[],
    value?: string
  ): Promise<string | undefined> {
    if (!functionName) return;
    await this.switchNetwork('l2');

    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });

    const paused = await this.readMarketContractL2('paused', []);
    const { maintenance } = await firstValueFrom(this.globalConfig$);

    if (paused) throw new Error('Contract is paused');
    if (maintenance) throw new Error('In maintenance mode');

    const tx: any = {
      address: bridgeAddressL2 as `0x${string}`,
      abi: EtherPhunksBridgeL2ABI,
      functionName,
      args,
      account: walletClient?.account?.address as `0x${string}`,
    };
    if (value) tx.value = value;

    const { request, result } = await simulateContract(this.l2Client, tx);
    return await walletClient?.writeContract(request);
  }

  /**
   * Reads data from the L2 marketplace contract
   * @param functionName The name of the contract function to call
   * @param args The arguments to pass to the function
   * @returns Promise resolving to the function result
   */
  async readMarketContractL2(functionName: any, args: (string | undefined)[]): Promise<any> {
    // console.log('l2client', this.l2Client);
    if (!this.l2Client?.chain) return null;
    const call: any = await readContract(this.l2Client, {
      address: marketAddressL2 as `0x${string}`,
      abi: EtherPhunksNftMarketABI,
      functionName,
      args: args as any,
    });
    // console.log('readMarketContractL2', {functionName, args, call});
    return call;
  }

  /**
   * Reads data from the L2 token contract
   * @param functionName The name of the contract function to call
   * @param args The arguments to pass to the function
   * @returns Promise resolving to the function result
   */
  async readTokenContractL2(functionName: any, args: (string | undefined)[]): Promise<any> {
    // console.log('l2client', this.l2Client);
    if (!this.l2Client?.chain) return null;
    const call: any = await readContract(this.l2Client, {
      address: bridgeAddressL2 as `0x${string}`,
      abi: EtherPhunksBridgeL2ABI,
      functionName,
      args: args as any,
    });
    // console.log('readTokenContractL2', {functionName, args, call});
    return call;
  }

  //////////////////////////////////
  // TXNS //////////////////////////
  //////////////////////////////////

  /**
   * Gets transaction details for a transaction on L1
   * @param hash The transaction hash to look up
   * @returns Promise resolving to the transaction details
   */
  async getTransactionL1(hash: string): Promise<any> {
    const transaction = await getTransaction(this.l1Client, { hash: hash as `0x${string}` });
    return transaction;
  }

  /**
   * Gets the transaction receipt for a transaction on L1
   * @param hash The transaction hash to get the receipt for
   * @returns Promise resolving to the transaction receipt if found
   */
  async getTransactionReceiptL1(hash: string): Promise<TransactionReceipt | undefined> {
    const receipt = await getTransactionReceipt(this.l1Client, { hash: hash as `0x${string}` });
    return receipt;
  }

  /**
   * Continuously polls for a transaction receipt until it is found
   * @param hash The transaction hash to poll for
   * @returns Promise resolving to the transaction receipt once found
   */
  pollReceipt(hash: string): Promise<TransactionReceipt> {
    let resolved = false;
    return new Promise(async (resolve, reject) => {
      while (!resolved) {
        // console.log('polling');
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
  // INSCRIPTION ///////////////////
  //////////////////////////////////

  /**
   * Inscribes a data URI on L1
   * @param dataUri The data URI to inscribe
   * @returns Promise resolving to the transaction hash if successful
   * @ISSUE: https://github.com/MetaMask/metamask-extension/issues/32495
   */
  async inscribe(dataUri: string): Promise<`0x${string}` | null> {
    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });

    const tx = await walletClient?.prepareTransactionRequest({
      to: walletClient.account.address,
      data: toHex(dataUri),
    });

    return await walletClient?.sendTransaction(tx);
  }

  //////////////////////////////////
  // UTILS /////////////////////////
  //////////////////////////////////

  async writeContract(args: any) {
    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });
    return await walletClient?.writeContract(args);
  }

  async signMessage(message: string): Promise<string> {
    const chainId = getChainId(this.config);
    const walletClient = await getWalletClient(this.config, { chainId });
    return await walletClient?.signMessage({
      account: walletClient?.account?.address as `0x${string}`,
      message
    });
  }

  /**
   * Gets the currently connected wallet address
   * @returns The connected address
   */
  getCurrentAddress(): `0x${string}` | undefined {
    const account = getAccount(this.config);
    return account.address;
  }

  /**
   * Gets the current block number on L1
   * @returns Promise resolving to the current block number
   */
  async getCurrentBlockL1(): Promise<number> {
    const blockNum = await getBlockNumber(this.l1Client);
    return Number(blockNum);
  }

  /**
   * Converts ETH amount to Wei
   * @param eth Amount in ETH to convert
   * @returns The amount in Wei as a bigint
   */
  ethToWei(eth: number): bigint {
    return parseEther(`${eth}`, 'wei');
  }

  /**
   * Converts Wei amount to ETH
   * @param wei Amount in Wei to convert
   * @returns The amount in ETH as a string
   */
  weiToEth(wei: any): string {
    return formatEther(wei);
  }

  /**
   * Verifies if a string is a valid Ethereum address or ENS name
   * @param address The address or ENS name to verify
   * @returns Promise resolving to the verified address or null if invalid
   */
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

  /**
   * Verifies if a string is a valid Ethereum address
   * @param address The address to verify
   * @returns The lowercase address if valid, null if invalid
   */
  verifyAddress(address: string | null): string | null {
    if (!address) return null;
    const valid = isAddress(address);
    if (valid) return address.toLowerCase();
    return null;
  }

  /**
   * Gets the Ethereum address associated with an ENS name
   * @param name The ENS name to lookup
   * @returns Promise resolving to the associated address
   */
  async getEnsOwner(name: string) {
    return await getEnsAddress(this.l1Client, { name });
  }

  /**
   * Gets the ENS name associated with an Ethereum address
   * @param address The address to lookup
   * @returns Promise resolving to the associated ENS name or null if not found
   */
  async getEnsFromAddress(address: string | null | undefined): Promise<string | null> {
    if (!address) return null;
    try {
      return await getEnsName(this.l1Client, { address: address as `0x${string}` });
    } catch (err) {
      return null;
    }
  }

  /**
   * Gets the avatar associated with an ENS name
   * @param name The ENS name to lookup
   * @returns Promise resolving to the avatar URL or null if not found
   */
  async getEnsAvatar(name: string): Promise<string | null> {
    if (!name) return null;
    return await getEnsAvatar(this.l1Client, { name });
  }

  /**
   * Signs a typed data message
   * @param typedData The typed data to sign
   * @returns Promise resolving to the signature and address
   */
  async signTypedMessage(typedData: any): Promise<{
    signature: `0x${string}`;
    address: `0x${string}`;
  }> {
    const account = getAccount(this.config);
    if (!account.isConnected) throw new Error('Wallet not connected');

    const signature = await signTypedData(this.config, typedData);

    return {
      signature,
      address: account.address as `0x${string}`,
    };
  }
}

