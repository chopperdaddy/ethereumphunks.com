import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationMessage } from '../models/message.model';

import { AttachmentBuilder, Client, codeBlock, EmbedBuilder, Events, GatewayIntentBits, TextChannel } from 'discord.js';

import { AppConfigService } from '@/config/config.service';

/**
 * Service for interacting with Discord to send notifications
 */
@Injectable()
export class DiscordService {

  /** Discord client instance */
  private client: Client;

  constructor(
    private readonly configSvc: AppConfigService
  ) {}

  /**
   * Initializes the Discord bot client
   * Creates a new client if one doesn't exist and logs in using the bot token
   * @returns Promise that resolves when the bot is ready
   */
  initializeBot(): Promise<void> {
    if (this.client) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.client = new Client({ intents: [GatewayIntentBits.Guilds] });

      this.client.on(Events.ClientReady, (readyClient) => {
        Logger.debug('Discord bot initialized.', readyClient.user.tag);
        resolve();
      });

      this.client.login(this.configSvc.notifications.discord.botToken);
    })
  }

  /**
   * Posts a notification message to Discord
   * @param data The notification message data containing title, message, link etc
   * @returns Promise that resolves when the message is sent
   */
  async postMessage(data: NotificationMessage): Promise<void> {
    if (!this.configSvc.features.discord) return;

    await this.initializeBot();

    // Get appropriate channel based on chain ID
    const chainId = this.configSvc.chain.chainIdL1;
    const channel = this.client.channels.cache.get(chainId === 1 ? '1202621714127912994' : '1227387575723888722') as TextChannel;

    // Build rich embed message with link - Discord will automatically fetch Open Graph image
    const exampleEmbed = new EmbedBuilder()
      .setColor(0xC3FF00)
      .setTitle(data.title)
      .setURL(data.link)
      .setDescription(codeBlock(data.message))
      // Discord will automatically fetch the og:image from the link
      // .setTimestamp()
      .setFooter({ text: 'Be Phree. Be Phunky. 👍' });

    // Send the message with embed - Discord will auto-generate preview from link
    await channel.send({ embeds: [exampleEmbed] });
  }
}

// Bot invite URL
// # https://discord.com/api/oauth2/authorize?client_id=1226779608406294588&permissions=2147485696&scope=bot%20applications.commands
