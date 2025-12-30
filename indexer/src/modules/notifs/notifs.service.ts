import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { formatUnits } from 'viem';

import { Event } from '@/modules/storage/models/db';
import { StorageService } from '@/modules/storage/storage.service';
import { NotificationMessage, NotifItemData } from './models/message.model';

import { rarityData } from './constants/rarity';

import { DiscordService } from './services/discord.service';
import { TwitterService } from './services/twitter.service';
import { Web3Service } from '@/modules/shared/services/web3.service';

import { AppConfigService } from '@/config/config.service';

/**
 * Service for handling notifications about marketPlace sales
 */
@Injectable()
export class NotifsService implements OnModuleInit {

  /** Current ETH/USD price */
  usdPrice: number = 0;

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3Svc: Web3Service,
    private readonly twitterSvc: TwitterService,
    private readonly discordSvc: DiscordService,
    private readonly storageSvc: StorageService,
    private readonly configSvc: AppConfigService
  ) {}

  async onModuleInit() {
    this.storageSvc.listenSales().subscribe(event => {
      this.handleNotification(event);
    });

    // Fetch USD price every 10 minutes
    this.fetchUSDPrice().then(price => {
      this.usdPrice = price;
      setInterval(async () => {
        this.usdPrice = await this.fetchUSDPrice();
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Handles notification for a specific hash ID
   * Sends based on last sale of hash ID
   * @param hashId The transaction hash ID
   */
  async handleNotificationFromHashId(hashId: string) {
    const event = await this.storageSvc.getLatestBoughtEventByHashId(hashId);
    await this.handleNotification(event);
  }

  /**
   * Processes notifications for Phunk sale events
   * @param phunkBoughtEvent The sale event data
   */
  async handleNotification(phunkBoughtEvent: Event): Promise<void> {
    const ethscriptionData = await this.getEthscriptionWithCollectionAndAttributes(phunkBoughtEvent.hashId);
    if (!ethscriptionData) return;

    const message = await this.createMessage(phunkBoughtEvent, ethscriptionData);
    if (!message) return;

    await this.twitterSvc.sendTweet(message);
    await this.discordSvc.postMessage(message);
  }

  /**
   * Creates a notification message for a Phunk sale event
   * @param event The sale event data
   * @returns Formatted notification message object
   */
  async createMessage(
    event: Event,
    ethscriptionData: NotifItemData
  ): Promise<NotificationMessage> {
    const { ethscription, collection } = ethscriptionData;

    const chainId = this.configSvc.chain.chainIdL1;
    const baseUrl = chainId === 1 ? 'https://ethereumphunks.com' : 'https://sepolia.ethereumphunks.com';

    const weiValue = BigInt(event.value);
    if (!weiValue) return;

    const value = formatUnits(weiValue, 18);

    const [fromAddress, toAddress] = await Promise.all([
      this.formatAddress(event.from),
      this.formatAddress(event.to)
    ]);

    const title = `${collection.singleName} #${ethscription.tokenId} was flipped`;
    const message = `From: ${fromAddress}\nTo: ${toAddress}\n\nFor: ${value} ETH ($${this.formatCash(Number(value) * this.usdPrice)})`;
    const link = `${baseUrl}/details/${ethscription.hashId}`;

    return {
      title,
      message,
      link,
    };
  }

  /**
   * Retrieves full Ethscription data including collection and attributes
   * @param hashId The Ethscription hash ID
   * @returns Ethscription data with collection and attributes
   * !FIXME: Update to use new attributes!
   */
  async getEthscriptionWithCollectionAndAttributes(hashId: string): Promise<NotifItemData> {
    const {
      ethscription,
      collection,
      attributes,
    } = await this.storageSvc.getEthscriptionWithCollectionAndAttributes(hashId);

    if (!attributes || !collection?.notifications) return null;

    const result = {
      ethscription,
      collection,
      attributes: Object.keys(attributes.values)?.map((key: string) => {
        const k = key;
        const v = Array.isArray(attributes.values[key])
          ? attributes.values[key].join(', ')
          : attributes.values[key];

        return {
          k,
          v,
          rarity: rarityData[ethscription.slug][v],
        };
      }).sort((a, b) => (a.rarity || Infinity) - (b.rarity || Infinity)),
    };

    return result;
  }

  /**
   * Fetches current ETH/USD price from CoinGecko API
   * @returns Current ETH price in USD
   */
  async fetchUSDPrice(): Promise<number> {
    const url = `https://api.coingecko.com/api/v3/simple/price`;

    const params = new URLSearchParams({
      ids: 'ethereum',
      vs_currencies: 'usd',
    });

    try {
      const response = await fetch(`${url}?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.log(error);
      return 0;
    }
  }

  /**
   * Formats an Ethereum address, using ENS name if available
   * @param address The Ethereum address
   * @returns Formatted address or ENS name
   */
  async formatAddress(address: string): Promise<string> {
    let fmatAddress = await this.web3Svc.getEnsFromAddress(address);
    if (!fmatAddress) fmatAddress = address.slice(0, 6) + '...' + address.slice(-4);
    return fmatAddress;
  }

  /**
   * Formats a number into a human-readable currency string with K/M/B/T suffixes
   * @param n The number to format
   * @param decimals Number of decimal places (default 2)
   * @returns Formatted currency string
   */
  formatCash(n: number, decimals: number = 2): string {
    if (n === 0) return '0';
    if (n < 1) return n.toFixed(2) + '';
    if (n < 1e3) return n.toFixed(decimals) + '';
    if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + 'K';
    if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'M';
    if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'B';
    if (n >= 1e12) return +(n / 1e12).toFixed(1) + 'T';
    return 0 + '';
  };
}
