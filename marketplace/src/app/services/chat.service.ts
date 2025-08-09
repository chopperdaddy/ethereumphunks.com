import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { toBytes, WalletClient } from 'viem';
import { Client, ClientOptions, ConsentState, DecodedMessage, Dm, Group, Identifier, Signer, SortDirection } from '@xmtp/browser-sdk';

import { NormalizedConversation, NormalizedConversationWithMessages, NormalizedMessage } from '@/models/chat';

// Agent message metadata marker
const AGENT_MESSAGE_PREFIX = '⚡AGENT_CTX⚡';

import { Web3Service } from './web3.service';
import { UtilService } from './util.service';
import { StorageService } from './storage.service';

import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  /** XMTP client instance */
  private client!: Client<unknown>;

  /** Agent wallet address for custom content type detection */
  private readonly AGENT_ADDRESS = environment.agent.address;

  /** XMTP client configuration options */
  private clientOptions: ClientOptions = {
    env: environment.agent.env,
    loggingLevel: 'off',
    // structuredLogging: true,
  };

  constructor(
    private web3Svc: Web3Service,
    private utilSvc: UtilService,
    private storageSvc: StorageService
  ) {
    // Clears all data from OPFS
    // navigator.storage.getDirectory().then(async (rootDir) => {
    //   await rootDir.removeEntry('.opfs-libxmtp-metadata', { recursive: true });
    //   console.log('Deleted .opfs-libxmtp-metadata');
    // });
  }

  /**
   * Creates a new XMTP user with the provided passcode
   * @param passcode Passcode for encrypting keys
   * @param address Ethereum address of the user
   * @returns Promise resolving to connection status and active inbox ID
   * @throws Error if XMTP client creation fails
   */
  async createXmtpUser(passcode: string, address: `0x${string}`): Promise<{ connected: boolean, activeInboxId: string | undefined }> {
    try {
      console.log('Creating XMTP user with passcode:', passcode);
      const dbEncryptionKey = await this.createEncryptionKeyFromPasscode(passcode, address);

      console.log('===============================================');
      console.log(
        'CREATE ENCRYPTION KEY:',
        dbEncryptionKey ? Array.from(dbEncryptionKey).map(b => b.toString(16).padStart(2, '0')).join('') : 'undefined (no encryption)'
      );
      console.log('===============================================');

      const walletClient = await this.web3Svc.getActiveWalletClient();
      const signer = this.createSCWSigner(walletClient);

      this.client = await Client.create(signer, {
        ...this.clientOptions,
        dbEncryptionKey,
      });

      if (this.client) {
        await this.client.conversations.syncAll();
        console.log('Signed in to XMTP', this.client.inboxId);
        return { connected: true, activeInboxId: this.client.inboxId };
      }
    } catch (error) {
      throw error;
    }

    return { connected: false, activeInboxId: undefined };
  }

  /**
   * Reconnects to XMTP using stored keys for an address
   * @param passcode Passcode for decrypting stored keys
   * @param address Ethereum address of the user
   * @returns Promise resolving to connection status and active inbox ID
   * @throws Error if no XMTP identity exists, incorrect passcode, or XMTP connection fails
   */
  async connectExistingXmtpUser(passcode: string, address: `0x${string}`): Promise<{ connected: boolean, activeInboxId: string | undefined }> {
    try {
      console.log('Connecting to XMTP with address:', address);
      const identifier: Identifier = {
        identifier: address,
        identifierKind: 'Ethereum',
      };

      const dbEncryptionKey = await this.getEncryptionKeyWithPasscode(passcode, address);

      console.log('===============================================');
      console.log(
        'GET ENCRYPTION KEY:',
        dbEncryptionKey ? Array.from(dbEncryptionKey).map(b => b.toString(16).padStart(2, '0')).join('') : 'undefined (no encryption)'
      );
      console.log('===============================================');

      this.client = await Client.build(identifier, {
        ...this.clientOptions,
        dbEncryptionKey,
      });

      if (this.client) {
        await this.client.conversations.syncAll();
        console.log('Reconnected to XMTP', this.client.inboxId);
        return { connected: true, activeInboxId: this.client.inboxId };
      }
    } catch (error) {
      throw error;
    }

    return { connected: false, activeInboxId: undefined };
  }

  /**
   * Disconnects from XMTP by closing the client connection
   */
  disconnectXmtp(): void {
    if (this.client) this.client.close();
  }

  /**
   * Lists and streams all direct message conversations from the XMTP client
   * @param address The Ethereum address of the current user
   * @returns Observable emitting arrays of normalized conversations
   * @throws Error if client connection fails, list/stream operation fails, or conversation normalization fails
   */
  listAndStreamAllDms(address: `0x${string}`): Observable<NormalizedConversation[]> {
    return new Observable<NormalizedConversation[]>(observer => {
      let conversations: NormalizedConversation[] = [];
      let closed = false;
      // Initial fetch
      this.client.conversations.listDms({
        consentStates: [ConsentState.Allowed, ConsentState.Denied, ConsentState.Unknown],
      }).then(async (allDms: Dm[]) => {
        console.log({allDms})
        conversations = (await Promise.all(allDms.map(dm => this.normalizeDmConversation(dm, address)))).filter(Boolean) as NormalizedConversation[];
        observer.next([...conversations]);
        // Start streaming new conversations
        await this.client.conversations.stream({
          onValue: async (conversation) => {
            if (conversation instanceof Dm && !closed) {
              const normalized = await this.normalizeDmConversation(conversation, address);
              if (normalized && !conversations.some(c => c.id === normalized.id)) {
                conversations = [...conversations, normalized];
                observer.next([...conversations]);
              }
            }
          },
          onError: (error) => {
            observer.error(error);
          },
          onFail: () => {
            observer.error(new Error('Stream failed'));
          }
        });
      }).catch(err => observer.error(err));
      // Teardown logic
      return () => { closed = true; };
    });
  }

  /**
   * Gets the most recent 100 messages from a conversation and streams new ones as they arrive
   * @param conversationId The ID of the conversation
   * @returns Observable emitting normalized conversation with messages (newest first)
   * @throws Error if no active inbox ID or wallet address found, conversation not found, or normalization fails
   */
  getAndStreamConversationMessages(conversationId: string): Observable<NormalizedConversationWithMessages> {
    const activeInboxId = this.client.inboxId;
    if (!activeInboxId) throw new Error('No active inbox ID found');

    // Get the current user's address for normalization
    const address = this.web3Svc.getCurrentAddress();
    if (!address) throw new Error('No wallet address found');

    return new Observable<NormalizedConversationWithMessages>(observer => {
      let messages: NormalizedMessage[] = [];
      let conversationInfo: NormalizedConversation | null = null;
      let closed = false;
      this.client.conversations.getConversationById(conversationId).then(async (conversation) => {
        if (!conversation) {
          observer.error(new Error('Conversation not found'));
          return;
        }
        // Normalize the conversation info
        conversationInfo = await this.normalizeDmConversation(conversation as Dm, address);
        if (!conversationInfo) {
          observer.error(new Error('Failed to normalize conversation'));
          return;
        }
        // Initial fetch
        const initialMessages = await conversation.messages({ limit: BigInt(100), direction: SortDirection.Descending });
        messages = await Promise.all(initialMessages.map(message => this.normalizeMessage(message as DecodedMessage, activeInboxId)));
        // Sort newest first
        messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        observer.next({ ...conversationInfo, messages: [...messages] });
        // Start streaming new messages
        await conversation.stream({
          onValue: async (message) => {
            if (!closed) {
              const normalized = await this.normalizeMessage(message as DecodedMessage, activeInboxId);
              // Only add if not already present (by id)
              if (!messages.some(m => m.id === normalized.id)) {
                messages = [normalized, ...messages];
                // Keep only the most recent 100
                messages = messages.slice(0, 100);
                observer.next({ ...conversationInfo!, messages: [...messages] });
              }
            }
          },
          onError: (error) => {
            observer.error(error);
          },
          onFail: () => {
            observer.error(new Error('Message stream failed'));
          }
        });
      }).catch(err => observer.error(err));
      // Teardown logic
      return () => { closed = true; };
    });
  }

  /**
   * Normalizes a DM conversation
   * @param dm The DM conversation to normalize
   * @param address The Ethereum address of the current user
   * @returns Promise resolving to normalized conversation or null if normalization fails
   */
  async normalizeDmConversation(dm: Dm, address: `0x${string}`): Promise<NormalizedConversation | null> {
    if (!dm) return null;
    try {
      const members = await dm.members();
      const consentState = await dm.consentState();
      const peerInboxId = await dm.peerInboxId();

      // Get latest message for proper timestamp
      const latestMessage = (await dm.messages({ limit: BigInt(1), direction: SortDirection.Descending }))[0];
      const latestMessageContent = latestMessage?.content as string;

      return {
        id: dm.id,
        timestamp: new Date(Number(latestMessage?.sentAtNs || dm.createdAtNs) / 1000000),
        peerInboxId,
        consentState,
        latestMessageContent,
        members: members.map(member => ({
          identifier: member.accountIdentifiers[0].identifier,
          identifierKind: member.accountIdentifiers[0].identifierKind,
        })).filter(member => member.identifier.toLowerCase() !== address.toLowerCase()),
      };
    } catch (err) {
      console.error('Failed to normalize DM:', err, dm);
      return null;
    }
  }

  /**
   * Normalizes a message
   * @param message The message to normalize
   * @param activeInboxId The current user's inbox ID to determine if message is from self
   * @returns Promise resolving to normalized message
   */
  async normalizeMessage(message: DecodedMessage, activeInboxId: string): Promise<NormalizedMessage> {
    console.log('normalizeMessage', {message, activeInboxId});

    let content = message.content as string;

    // If this is the user's own message and it contains encoded context, extract the clean message
    const isSelf = message.senderInboxId === activeInboxId;
    if (isSelf && content && typeof content === 'string' && content.startsWith(AGENT_MESSAGE_PREFIX)) {
      // Extract clean message from encoded format: ⚡AGENT_CTX⚡{context}⚡END_CTX⚡{message}
      const parts = content.split('⚡END_CTX⚡');
      if (parts.length === 2) {
        content = parts[1]; // The actual user message
        console.log('📝 Extracted clean message from encoded format:', content);
      }
    }

    return {
      id: message.id,
      content: content,
      timestamp: new Date(Number(message.sentAtNs) / 1000000),
      senderInboxId: message.senderInboxId,
      self: isSelf,
    };
  }

  /**
   * Creates a new DM conversation with the provided address
   * @param to The address of the user to create a conversation with
   * @returns Promise resolving to the conversation ID
   * @throws Error if the conversation creation fails
   */
  async createConversation(to: string): Promise<string> {
    try {
      const conversation = await this.client.conversations.newDmWithIdentifier({
        identifier: to,
        identifierKind: 'Ethereum',
      });
      return conversation.id;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a conversation is with the agent
   */
  private async isAgentConversation(conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) {
        console.log('❌ No conversation found for ID:', conversationId);
        return false;
      }

      console.log('🔍 Checking conversation for agent:', {
        conversationId,
        conversationType: conversation.constructor.name,
        agentAddress: this.AGENT_ADDRESS
      });

      // For DM conversations, check members to find the peer
      if (conversation instanceof Object && 'members' in conversation) {
        const dm = conversation as Dm;
        try {
          const members = await dm.members();
          console.log('👥 DM members:', members);

          // Get current user address to filter out self
          const currentAddress = this.web3Svc.getCurrentAddress()?.toLowerCase();

          // Find the peer (not the current user)
          const peer = members.find(member =>
            member.accountIdentifiers[0]?.identifier.toLowerCase() !== currentAddress
          );

          if (peer) {
            const peerAddress = peer.accountIdentifiers[0].identifier.toLowerCase();
            const isAgent = peerAddress === this.AGENT_ADDRESS;
            console.log('🤖 Agent conversation check:', {
              peerAddress,
              agentAddress: this.AGENT_ADDRESS,
              currentAddress,
              isAgent
            });
            return isAgent;
          }
        } catch (membersError) {
          console.error('Error getting DM members:', membersError);
        }
      }

      console.log('👥 Non-DM conversation or couldn\'t get members');
      return false;
    } catch (error) {
      console.error('Error checking if conversation is with agent:', error);
      return false;
    }
  }

  /**
   * Sends a message to a conversation
   * @param conversationId The ID of the conversation
   * @param message The message to send
   * @param context Optional context to include with the message (invisible to user)
   * @returns Promise resolving to the message ID
   * @throws Error if the message sending fails
   */
  async sendMessageToConversation(conversationId: string, message: string, context?: string): Promise<string> {
    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) throw new Error('Conversation not found');

      // Check if this is a conversation with the agent
      const isAgent = await this.isAgentConversation(conversationId);

      console.log('📤 Sending message:', {
        conversationId,
        messageLength: message.length,
        hasContext: !!context,
        contextLength: context?.length || 0,
        isAgent
      });

      if (isAgent && context) {
        // Use special encoding for agent communication
        // Format: ⚡AGENT_CTX⚡{context}⚡END_CTX⚡{message}
        const agentMessage = `${AGENT_MESSAGE_PREFIX}${context}⚡END_CTX⚡${message}`;
        console.log('🤖 Sending encoded agent message:', {
          agentMessageLength: agentMessage.length,
          prefix: AGENT_MESSAGE_PREFIX,
          contextPreview: context.substring(0, 100) + '...'
        });
        return await conversation.send(agentMessage);
      } else {
        // Standard text message for non-agent conversations
        console.log('💬 Sending standard message (not agent or no context)');
        return await conversation.send(message);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sends a message with automatic page context detection
   * @param conversationId The ID of the conversation
   * @param message The message to send
   * @param pageContext The current page context
   * @returns Promise resolving to the message ID
   */
  async sendMessageWithPageContext(conversationId: string, message: string, pageContext: any): Promise<string> {
    try {
      console.log('🎯 sendMessageWithPageContext called with:', {
        conversationId,
        message,
        pageContext
      });

      // Format context for the agent
      const contextString = this.formatPageContextForAgent(pageContext);

      console.log('📝 Context formatted, calling sendMessageToConversation...');

      return await this.sendMessageToConversation(conversationId, message, contextString);
    } catch (error) {
      console.error('❌ Error in sendMessageWithPageContext:', error);
      throw error;
    }
  }

  /**
   * Format page context for agent consumption
   */
  private formatPageContextForAgent(pageContext: any): string {
    if (!pageContext) {
      console.warn('No pageContext provided to formatPageContextForAgent');
      return '';
    }

    console.log('📋 Formatting page context:', pageContext);

    const contextParts: string[] = ['[FRONTEND_CONTEXT]'];

    // Add page information
    if (pageContext.type) {
      contextParts.push(`PAGE_TYPE:${pageContext.type}`);
    }

    // Add network information
    if (pageContext.network) {
      contextParts.push(`NETWORK:${pageContext.network.name}`);
      contextParts.push(`CHAINID:${pageContext.network.chainId}`);
    } else {
      console.warn('No network information in pageContext');
    }

    if (pageContext.data) {
      Object.entries(pageContext.data).forEach(([key, value]) => {
        if (value) {
          contextParts.push(`${key.toUpperCase()}:${value}`);
        }
      });
    }

    // Add route info
    if (pageContext.route) {
      contextParts.push(`ROUTE:${pageContext.route}`);
    }

    // Add timestamp
    contextParts.push(`TIMESTAMP:${pageContext.timestamp || new Date().toISOString()}`);

    contextParts.push('[/FRONTEND_CONTEXT]');

    const formattedContext = contextParts.join('|');
    console.log('📤 Formatted context string:', formattedContext);

    return formattedContext;
  }

  /**
   * Creates a signer for XMTP using the wallet client
   * @param walletClient The wallet client to create signer from
   * @returns Signer object for XMTP
   * @throws Error if no wallet address is found
   */
  private createSCWSigner(walletClient: WalletClient): Signer {
    const address = walletClient.account?.address;
    if (!address) throw new Error('No wallet address found');

    return {
      type: 'EOA',
      getIdentifier: () => ({
        identifier: address.toLowerCase(),
        identifierKind: 'Ethereum',
      }),
      signMessage: async (message: string) => {
        const signature = await walletClient.signMessage({
          account: address,
          message,
        });
        return toBytes(signature);
      },
    };
  }

  /**
   * Creates an encryption key from a passcode and address
   * @param passcode User's passcode for encryption
   * @param address User's wallet address
   * @returns Promise resolving to encryption key as Uint8Array or undefined if no passcode
   */
  private async createEncryptionKeyFromPasscode(passcode: string, address: `0x${string}`): Promise<Uint8Array | undefined> {
    // If no passcode provided, return undefined (no encryption)
    if (!passcode) {
      // Still create and store a salt for tracking user existence
      await this.getOrCreateUserSalt(address);
      return undefined;
    }

    // Get user salt - used for PBKDF2 key derivation
    const salt = await this.createSalt();

    // Derive key from passcode
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(passcode), {name: 'PBKDF2'}, false, ['deriveKey']
    );

    // Generate a strong encryption key directly from the passcode
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // Make key extractable
      ['encrypt', 'decrypt']
    );

    // Export the key as raw bytes to use as dbEncryptionKey
    const keyBytes = await window.crypto.subtle.exportKey('raw', key);
    return new Uint8Array(keyBytes);
  }

  /**
   * Gets the encryption key for an existing user using their passcode
   * @param passcode Passcode for deriving the key
   * @param address User's wallet address
   * @returns Promise resolving to encryption key as Uint8Array or undefined if no passcode
   * @throws Error if no XMTP identity exists for the address (when passcode is required)
   */
  private async getEncryptionKeyWithPasscode(passcode: string, address: `0x${string}`): Promise<Uint8Array | undefined> {
    // If no passcode provided, return undefined (no encryption)
    if (!passcode) return undefined;

    // Check if user salt exists
    const userSalt = await this.storageSvc.getItem<string>(`user-salt-${address}`, true);
    if (!userSalt) {
      throw new Error('No XMTP identity found for this address. Please create a new identity first.');
    }

    const salt = this.utilSvc.base64ToUint8Array(userSalt);

    // Derive key from passcode
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(passcode), {name: 'PBKDF2'}, false, ['deriveKey']
    );

    // Generate encryption key from the passcode using same parameters
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Export the key as raw bytes
    const keyBytes = await window.crypto.subtle.exportKey('raw', key);
    return new Uint8Array(keyBytes);
  }

  /**
   * Gets or creates a salt for the user's encryption
   * @param address User's wallet address
   * @returns Promise resolving to salt as Uint8Array
   */
  private async getOrCreateUserSalt(address: `0x${string}`): Promise<Uint8Array> {
    const userSalt = await this.storageSvc.getItem<string>(`user-salt-${address}`, true);
    if (userSalt) return this.utilSvc.base64ToUint8Array(userSalt);

    const salt = this.createSalt();
    await this.storageSvc.setItem(`user-salt-${address}`, this.utilSvc.uint8ArrayToBase64(salt), true);
    return salt;
  }

  /**
   * Creates a new salt for the user
   * @returns Promise resolving to salt as Uint8Array
   */
  private createSalt(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Gets the salt for a user
   * @param address User's wallet address
   * @returns Promise resolving to salt as Uint8Array or undefined if no salt exists
   */
  private async getSalt(address: `0x${string}`): Promise<Uint8Array | undefined> {
    const userSalt = await this.storageSvc.getItem<string>(`user-salt-${address}`, true);
    if (userSalt) return this.utilSvc.base64ToUint8Array(userSalt);
    return;
  }

  /**
   * Checks if a user has required encryption parameters stored
   * @param address User's wallet address
   * @returns Promise resolving to boolean indicating if salt exists
   */
  async hasStoredUserSalt(address: `0x${string}`): Promise<boolean> {
    const userSalt = await this.getSalt(address);
    return !!userSalt;
  }
}
