import { Injectable, OnModuleInit } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Client, Signer, type XmtpEnv, IdentifierKind, LogLevel } from '@xmtp/node-sdk';
import { createWalletClient, fromHex, http, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { getRandomValues } from 'crypto';

import { KeyGenService } from './services/key-gen.service';

interface User {
  key: `0x${string}`;
  account: any;
  wallet: any;
}

import dotenv from 'dotenv';
dotenv.config();

const DIGITAL_OCEAN_AGENT_URL = 'https://h5en4ny26mkz6fhtx6wczs2c.agents.do-ai.run/api/v1/chat/completions';

interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  lastActivity: Date;
}

export class AgentService implements OnModuleInit {
  private readonly agentApiKey: string;
  private conversations: Map<string, ConversationHistory> = new Map();
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  signer = this.createSigner(process.env.AGENT_WALLET_PK as `0x${string}`);
  dbEncryptionKey = this.getEncryptionKeyFromHex(
    process.env.AGENT_ENCRYPTION_KEY as string
  );

  constructor(
    private readonly keyGenSvc: KeyGenService,
  ) {
    this.agentApiKey = process.env.DIGITAL_OCEAN_AGENT_API_KEY;
    if (!this.agentApiKey) {
      throw new Error('DIGITAL_OCEAN_AGENT_API_KEY environment variable is not set');
    }
  }

  /**
   * Process XMTP message
   */
    private getConversationHistory(conversationId: string): ConversationHistory {
    // Clean up old conversations
    this.cleanupOldConversations();

    // Get or create conversation history
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        messages: [],
        lastActivity: new Date()
      };
      this.conversations.set(conversationId, conversation);
    }
    return conversation;
  }

  private cleanupOldConversations() {
    const now = new Date().getTime();
    for (const [id, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity.getTime() > this.CONVERSATION_TIMEOUT) {
        this.conversations.delete(id);
      }
    }
  }

  private updateConversation(conversationId: string, userMessage: string, assistantMessage: string) {
    const conversation = this.getConversationHistory(conversationId);
    conversation.messages.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    conversation.lastActivity = new Date();
  }

  private async callDigitalOceanAgent(message: string, conversationId: string): Promise<string> {
    try {
      console.log('Calling Digital Ocean agent with message:', message);

      const conversation = this.getConversationHistory(conversationId);

      const requestBody = {
        messages: [
          ...conversation.messages,
          {
            role: 'user',
            content: message
          }
        ],
        stream: false
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(DIGITAL_OCEAN_AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.agentApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`API call failed with status: ${response.status}. Response: ${errorText}`);
      }

      const data = await response.json();
      console.log('Digital Ocean agent response:', data);

      // Extract the assistant's message from the response
      const assistantMessage = data.choices?.[0]?.message?.content;
      if (!assistantMessage) {
        console.error('Unexpected response format:', data);
        throw new Error('Invalid response format from agent');
      }
      return assistantMessage;
    } catch (error) {
      console.error('Error calling Digital Ocean agent:', error);
      throw error;
    }
  }

  async processMessage(message: any): Promise<string> {
    try {
      const messageText = message.content as string;
      console.log(`📨 Received message: ${messageText}`);

      const response = await this.callDigitalOceanAgent(messageText, message.conversationId);
      this.updateConversation(message.conversationId, messageText, response);
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return 'Sorry, there was an error processing your message. Please try again.';
    }
  }

  onModuleInit() {
    this.main().catch(console.error);
  }

  async main() {
    console.log(`Creating client on the '${process.env.XMTP_ENV || 'dev'}' network...`);
    const signerIdentifier = (await this.signer.getIdentifier()).identifier;
    const client = await Client.create(this.signer, {
      dbEncryptionKey: this.dbEncryptionKey,
      env: process.env.XMTP_ENV as XmtpEnv,
      dbPath: this.getDbPath((process.env.XMTP_ENV || 'dev') + '-' + signerIdentifier),
      loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    });
    this.logAgentDetails(client);

    console.log('Syncing conversations...');
    await client.conversations.sync();

    console.log('Waiting for messages...');
    const stream = client.conversations.streamAllMessages();

    for await (const message of await stream) {
      // Skip our own messages and non-text messages
      if (
        message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== 'text'
      ) {
        continue;
      }

      const conversation = await client.conversations.getConversationById(
        message.conversationId
      );

      if (!conversation) {
        console.log('Unable to find conversation, skipping');
        continue;
      }

      try {
        const response = await this.processMessage(message);
        await conversation.send(response);
      } catch (error) {
        console.error('Error processing message:', error);
        await conversation.send('There was an error processing your message. Please try again.');
      }

      console.log('Waiting for messages...');
    }
  }

  createUser(key: string): User {
    const account = privateKeyToAccount(key as `0x${string}`);
    return {
      key: key as `0x${string}`,
      account,
      wallet: createWalletClient({
        account,
        chain: sepolia,
        transport: http(),
      }),
    };
  }

  createSigner(key: string): Signer {
    const sanitizedKey = key.startsWith('0x') ? key : `0x${key}`;
    const user = this.createUser(sanitizedKey);
    return {
      type: 'EOA',
      getIdentifier: () => ({
        identifierKind: IdentifierKind.Ethereum,
        identifier: user.account.address.toLowerCase(),
      }),
      signMessage: async (message: string) => {
        const signature = await user.wallet.signMessage({
          message,
          account: user.account,
        });
        return toBytes(signature);
      },
    };
  }

  getEncryptionKeyFromHex(hex: string) {
    /* Convert the hex string to an encryption key */
    return fromHex(hex as `0x${string}`, 'bytes');
  }

  generateEncryptionKeyHex() {
    /* Generate a random encryption key */
    const uint8Array = getRandomValues(new Uint8Array(32));
    /* Convert the encryption key to a hex string */
    return toHex(uint8Array);
  }

  getDbPath(description: string = 'xmtp') {
    // Use Railway volume path if available, otherwise use local .data directory
    const volumePath = join(process.cwd(), '.data/xmtp');

    // Create database directory if it doesn't exist
    if (!existsSync(volumePath)) {
      mkdir(volumePath, { recursive: true });
    }

    return join(volumePath, `${description}.db3`);
  }

  logAgentDetails(client: Client): void {
    console.log(`\x1b[38;2;252;76;52m
      ██╗  ██╗███╗   ███╗████████╗██████╗
      ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
       ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
       ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝
      ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║
      ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝
    \x1b[0m`);
    const address = client.accountIdentifier?.identifier ?? '';
    const inboxId = client.inboxId;
    const env = client.options?.env ?? 'dev';
    console.log(`
  ✓ XMTP Client Ready:
  • Address: ${address}
  • InboxId: ${inboxId}
  • Network: ${env}
  • URL: http://xmtp.chat/dm/${address}?env=${env}`);
  }
}
