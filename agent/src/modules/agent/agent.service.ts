import { Injectable, OnModuleInit } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Client, Signer, type XmtpEnv, IdentifierKind, LogLevel } from '@xmtp/node-sdk';

// Agent message metadata marker (must match frontend)
const AGENT_MESSAGE_PREFIX = '⚡AGENT_CTX⚡';

import { createWalletClient, fromHex, http, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { getRandomValues } from 'crypto';

import { KeyGenService } from './services/key-gen.service';
import { LangchainService } from './services/langchain.service';

interface User {
  key: `0x${string}`;
  account: any;
  wallet: any;
}

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AgentService implements OnModuleInit {

  signer = this.createSigner(process.env.AGENT_WALLET_PK as `0x${string}`);
  dbEncryptionKey = this.getEncryptionKeyFromHex(
    process.env.AGENT_ENCRYPTION_KEY as string
  );

  constructor(
    private readonly keyGenSvc: KeyGenService,
    private readonly langchainSvc: LangchainService,
  ) {}

  /**
   * Parse structured context from custom content type
   */
  private parseStructuredContext(contextString: string): any {
    try {
      // The context comes from the frontend's formatPageContextForAgent method
      // Parse the [FRONTEND_CONTEXT] format
      const match = contextString.match(/\[FRONTEND_CONTEXT\]([\s\S]*?)\[\/FRONTEND_CONTEXT\]/);
      if (!match) return null;

      const contextData = match[1];
      const context: any = {};

      // Parse the pipe-separated key:value pairs
      const pairs = contextData.split('|');
      for (const pair of pairs) {
        const [key, value] = pair.split(':');
        if (key && value) {
          context[key.toLowerCase().trim()] = value.trim();
        }
      }

      return context;
    } catch (error) {
      console.error('Error parsing structured context:', error);
      return null;
    }
  }

  /**
   * Process XMTP message and provide contextualized response
   */
  async processMessageWithContext(message: any, conversation: any): Promise<string> {
    // Extract the sender's Ethereum address from the conversation
    const senderAddress = await this.extractSenderAddress(message, conversation);

    let cleanMessage: string;
    let frontendContext: any = null;

    // Check if this is a special agent message with encoded context
    const messageText = message.content as string;
    if (messageText && messageText.startsWith(AGENT_MESSAGE_PREFIX)) {

      // Handle encoded agent message format: ⚡AGENT_CTX⚡{context}⚡END_CTX⚡{message}
      const parts = messageText.split('⚡END_CTX⚡');
      if (parts.length === 2) {
        const contextPart = parts[0].replace(AGENT_MESSAGE_PREFIX, '');
        cleanMessage = parts[1];

        // Parse the structured context
        frontendContext = this.parseStructuredContext(contextPart);

        console.log('📨 Received encoded agent message:', {
          message: cleanMessage,
          hasContext: !!contextPart,
          contextLength: contextPart.length
        });
      } else {
        // Fallback if parsing fails
        cleanMessage = messageText;
        frontendContext = null;
      }
    } else {
      // Handle legacy format - extract context from message text
      const extracted = this.extractFrontendContext(messageText);
      cleanMessage = extracted.cleanMessage;
      frontendContext = extracted.frontendContext;

      console.log('📨 Received legacy text message');
    }

    if (senderAddress) {
      // Create contextualized message with network and page info
      const contextualMessage = this.buildContextualMessage(cleanMessage, senderAddress, frontendContext);

      console.log(`Processing message with context for ${senderAddress}:`, {
        userAddress: senderAddress,
        network: frontendContext?.network || 'unknown',
        chainId: frontendContext?.chainid || 'unknown',
        pageType: frontendContext?.page_type || 'unknown',
        route: frontendContext?.route || 'unknown'
      });

      return await this.langchainSvc.ask(contextualMessage, message.conversationId);
    }

    // Fallback to original message if no context available
    return await this.langchainSvc.ask(cleanMessage, message.conversationId);
  }

  /**
   * Extract frontend context from message content and return clean message
   */
  extractFrontendContext(messageContent: string): { cleanMessage: string; frontendContext: any } {
    try {
      // Look for frontend context pattern: [FRONTEND_CONTEXT]...[/FRONTEND_CONTEXT]
      const contextMatch = messageContent.match(/\[FRONTEND_CONTEXT\]([\s\S]*?)\[\/FRONTEND_CONTEXT\]/);

      if (contextMatch) {
        const contextString = contextMatch[1];
        const cleanMessage = messageContent.replace(contextMatch[0], '').trim();

        // Parse the context string
        const contextParts = contextString.split('|').filter(part => part.trim());
        const frontendContext: any = {};

        for (const part of contextParts) {
          if (part.includes(':')) {
            const [key, value] = part.split(':');
            frontendContext[key.toLowerCase()] = value;
          }
        }

        // Determine if this is Sepolia or Mainnet based on network info
        frontendContext.isSepoliaNetwork = frontendContext.network === 'sepolia' || frontendContext.chainid === '11155111';

        return { cleanMessage, frontendContext };
      }

      return { cleanMessage: messageContent, frontendContext: null };
    } catch (error) {
      console.error('Error extracting frontend context:', error);
      return { cleanMessage: messageContent, frontendContext: null };
    }
  }

  /**
   * Extract the sender's Ethereum address from XMTP message
   */
  async extractSenderAddress(message: any, conversation: any): Promise<string | null> {
    try {
      // Get conversation members to find the sender's address
      const members = await conversation.members();
      const sender = members.find((member: any) =>
        member.inboxId === message.senderInboxId
      );

      if (sender && sender.accountIdentifiers && sender.accountIdentifiers.length > 0) {
        // Return the Ethereum address (first account identifier)
        return sender.accountIdentifiers[0].identifier.toLowerCase();
      }
    } catch (error) {
      console.error('Error extracting sender address:', error);
    }

    return null;
  }

  /**
   * Build a contextualized message with network and page info
   */
  buildContextualMessage(originalMessage: string, userAddress: string, frontendContext: any): string {
    console.log('🔧 Building contextual message with:', {
      userAddress,
      frontendContext,
      keys: frontendContext ? Object.keys(frontendContext) : 'no context'
    });

    // Build network information
    const network = frontendContext?.network || 'unknown';
    const chainId = frontendContext?.chainid || 'unknown';
    const pageType = frontendContext?.page_type || 'unknown';
    const route = frontendContext?.route || 'unknown';

    console.log('📋 Context values extracted:', {
      network,
      chainId,
      pageType,
      route
    });

    // Create a context section with database guidance for the LLM
    const tableSuffix = network === 'sepolia' || chainId === '11155111' ? '_sepolia' : '';
    const contextSection = `
[SYSTEM CONTEXT - User: ${userAddress}]
- Network: ${network} (Chain ID: ${chainId})
- Page: ${pageType} at ${route}
- User Address: ${userAddress}
- Database Tables: Use ethscriptions${tableSuffix}, listings${tableSuffix}, events${tableSuffix}, bids${tableSuffix}
- REMINDER: For ownership questions, you MUST query the database using mcp__supabase__execute_sql
- Timestamp: ${new Date().toISOString()}
[END CONTEXT]

User Message: ${originalMessage}`;

    console.log('📤 Final contextual message:', contextSection);

    return contextSection;
  }

  // ... rest of XMTP setup methods remain the same ...

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
      if (
        message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== 'text'
      ) {
        continue;
      }

      console.log(
        `Received message: ${message.content as string} by ${
          message.senderInboxId
        }`
      );

      const conversation = await client.conversations.getConversationById(
        message.conversationId
      );

      if (!conversation) {
        console.log('Unable to find conversation, skipping');
        continue;
      }

      // Process message with context
      try {
        const aiResponse = await this.processMessageWithContext(
          message,
          conversation
        );
        await conversation.send(aiResponse);

        // setInterval(async () => {
        //   await conversation.send(`This is a test message ${new Date().toISOString()}`);
        // }, 100000);
      } catch (error) {
        console.error(error);
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
