import { Injectable, OnModuleInit } from '@nestjs/common';
import { Scraper } from 'agent-twitter-client';
import { NotificationMessage } from '../models/message.model';

import * as fs from 'fs';
import * as path from 'path';

import { AppConfigService } from '@/config/config.service';

/**
 * Service for interacting with Twitter to send tweets and manage authentication
 */
@Injectable()
export class TwitterService {
  /** Twitter scraper instance for API interactions */
  private scraper: Scraper;
  /** Path to store Twitter authentication cookies */
  private readonly COOKIES_PATH = path.join(process.cwd(), 'twitter-cookies.json');

  constructor(
    private readonly configSvc: AppConfigService
  ) {
    this.scraper = new Scraper();
  }

  /**
   * Initializes Twitter service by loading saved cookies or performing fresh login
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (!this.configSvc.features.twitter) return;

    try {
      // Try to load existing cookies
      if (await this.loadCookies()) {
        return;
      }

      // If no valid cookies, perform fresh login
      console.log('Performing fresh login...');
      await this.scraper.login(
        this.configSvc.notifications.twitter.username,
        this.configSvc.notifications.twitter.password,
        undefined,
        this.configSvc.notifications.twitter.twoFactorSecret
      );

      // Save the new cookies
      await this.saveCookies();
      console.log('Successfully saved cookies');

      const me = await this.scraper.me();
      console.log('Logged into twitters as:', me.username);
    } catch (error) {
      console.error('Failed to initialize Twitter service:', error);
      throw error;
    }
  }

  /**
   * Loads saved cookies from file and sets them in the scraper
   * @returns True if cookies were successfully loaded, false otherwise
   */
  private async loadCookies(): Promise<boolean> {
    try {
      if (fs.existsSync(this.COOKIES_PATH)) {
        const cookiesJson = fs.readFileSync(this.COOKIES_PATH, 'utf8');
        const cookiesArray = JSON.parse(cookiesJson);
        // console.log('Raw cookies from file:', cookiesArray);

        // Format cookies as strings in the standard cookie format
        const formattedCookies = cookiesArray.map(cookie => {
          return `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}${cookie.secure ? '; Secure' : ''}${cookie.httpOnly ? '; HttpOnly' : ''}${cookie.expires ? `; Expires=${new Date(cookie.expires).toUTCString()}` : ''}${cookie.sameSite ? `; SameSite=${cookie.sameSite}` : ''}`;
        });

        // console.log('Formatted cookie strings:', formattedCookies);
        await this.scraper.setCookies(formattedCookies);
        return true;
      }
    } catch (error) {
      console.error('Error loading cookies:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
    }
    return false;
  }

  /**
   * Saves current session cookies to file
   * Only saves if essential authentication cookies are present
   */
  private async saveCookies(): Promise<void> {
    try {
      const cookies = await this.scraper.getCookies();
      fs.writeFileSync(this.COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log('Successfully saved session cookies');
    } catch (error) {
      console.error('Error saving cookies:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
    }
  }

  /**
   * Sends a tweet with link - Twitter will automatically generate card preview from Open Graph meta tags
   * @param data The notification message data containing title, message, link
   * @throws Error if tweet fails to send
   */
  async sendTweet(data: NotificationMessage): Promise<void> {
    if (!this.configSvc.features.twitter) return;

    try {
      await this.initialize();

      const { title, message, link } = data;
      // Twitter will automatically fetch Open Graph meta tags and create a card preview
      await this.scraper.sendTweet(
        `${title}\n\n${message}\n\n${link}`,
        undefined,
        undefined // No image attachment - Twitter will use og:image from the link
      );
    } catch (error) {
      console.error('Failed to send tweet:', error);
      throw error;
    }
  }
}
