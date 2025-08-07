import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { toBytes, WalletClient } from 'viem';
import { Client, ClientOptions, DecodedMessage, Dm, Group, Identifier, Signer, SortDirection } from '@xmtp/browser-sdk';

import { NormalizedConversation, NormalizedConversationWithMessages, NormalizedMessage } from '@/models/chat';

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

  /** XMTP client configuration options */
  private clientOptions: ClientOptions = {
    env: environment.agent.env,
    // loggingLevel: 'off',
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
      this.client.conversations.listDms().then(async (allDms: Dm[]) => {
        conversations = (await Promise.all(allDms.map(dm => this.normalizeDmConversation(dm, address)))).filter(Boolean) as NormalizedConversation[];
        observer.next([...conversations]);
        console.log('conversations', conversations);
        // Start streaming new conversations
        const stream = await this.client.conversations.stream({
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
        members: members.map((m: any) => {
          return m.accountIdentifiers
            .filter((res: any) => res.identifierKind === 'Ethereum' && res.identifier !== address)[0];
        }).filter((m: any) => !!m),
      };
    } catch (err) {
      console.error('Failed to normalize DM:', err, dm);
      return null;
    }
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
        const messageStream = await conversation.stream({
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
   * Normalizes a message
   * @param message The message to normalize
   * @param activeInboxId The current user's inbox ID to determine if message is from self
   * @returns Promise resolving to normalized message
   */
  async normalizeMessage(message: DecodedMessage, activeInboxId: string): Promise<NormalizedMessage> {
    return {
      id: message.id,
      content: message.content as string,
      timestamp: new Date(Number(message.sentAtNs) / 1000000),
      senderInboxId: message.senderInboxId,
      self: message.senderInboxId === activeInboxId,
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
   * Sends a message to a conversation
   * @param conversationId The ID of the conversation
   * @param message The message to send
   * @returns Promise resolving to the message ID
   * @throws Error if the message sending fails
   */
  async sendMessageToConversation(conversationId: string, message: string): Promise<string> {
    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) throw new Error('Conversation not found');
      return await conversation.send(message);
    } catch (error) {
      throw error;
    }
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
