import { Injectable } from '@angular/core';
import { Observable, of, Subject, merge } from 'rxjs';
import { share, shareReplay } from 'rxjs/operators';

import { toBytes, WalletClient } from 'viem';
import { Client, ClientOptions, ConsentState, DecodedMessage, Dm, Group, Identifier, SafeContentTypeId, Signer, SortDirection } from '@xmtp/browser-sdk';

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
   * @param passcode Passcode used to encrypt the user's XMTP keys
   * @param address Ethereum address of the user
   * @returns Promise resolving to connection status and active inbox ID
   * @throws Error if XMTP client creation fails or encryption key generation fails
   */
  async createXmtpUser(passcode: string, address: `0x${string}`): Promise<{ connected: boolean, activeInboxId: string | undefined }> {
    try {
      const dbEncryptionKey = await this.createEncryptionKeyFromPasscode(passcode, address);
      const walletClient = await this.web3Svc.getActiveWalletClient();
      const signer = this.createSCWSigner(walletClient);

      this.client = await Client.create(signer, {
        ...this.clientOptions,
        dbEncryptionKey,
      });

      if (this.client) {
        await this.client.preferences.sync();
        await this.client.conversations.sync();
        await this.client.conversations.syncAll();
        console.log('Signed in to XMTP', this.client.inboxId, address);
        return { connected: true, activeInboxId: this.client.inboxId };
      }
    } catch (error) {
      throw error;
    }

    return { connected: false, activeInboxId: undefined };
  }

  /**
   * Reconnects to XMTP using stored keys for an address
   * @param passcode Passcode used to decrypt the stored XMTP keys
   * @param address Ethereum address of the user
   * @returns Promise resolving to connection status and active inbox ID
   * @throws Error if no XMTP identity exists, incorrect passcode, encryption key derivation fails, or XMTP connection fails
   */
  async connectExistingXmtpUser(passcode: string, address: `0x${string}`): Promise<{ connected: boolean, activeInboxId: string | undefined }> {
    try {
      const identifier: Identifier = {
        identifier: address,
        identifierKind: 'Ethereum',
      };

      const dbEncryptionKey = await this.getEncryptionKeyWithPasscode(passcode, address);

      this.client = await Client.build(identifier, {
        ...this.clientOptions,
        dbEncryptionKey,
      });

      if (this.client) {
        await this.client.preferences.sync();
        await this.client.conversations.sync();
        await this.client.conversations.syncAll();
        console.log('Reconnected to XMTP', this.client.inboxId, address);
        return { connected: true, activeInboxId: this.client.inboxId };
      }
    } catch (error) {
      throw error;
    }

    return { connected: false, activeInboxId: undefined };
  }

  /**
   * Disconnects from XMTP by closing the client connection
   * Should be called when user logs out or switches accounts
   */
  disconnectXmtp(): void {
    if (this.client) this.client.close();
  }

  /**
   * Lists and streams all direct message conversations from the XMTP client
   * @param address The Ethereum address of the current user
   * @returns Observable emitting arrays of normalized conversations, sorted by latest message timestamp
   * @throws Error if client connection fails, list/stream operation fails, or conversation normalization fails
   */
  listAndStreamAllDms(address: `0x${string}`): Observable<NormalizedConversation[]> {
    return new Observable<NormalizedConversation[]>(observer => {
      let conversations: NormalizedConversation[] = [];
      let closed = false;
      let conversationStreamSubscription: any = null;
      let allMessagesSubscription: any = null;

      // Initial fetch
      this.client.conversations.listDms({
        consentStates: [ConsentState.Allowed, ConsentState.Denied, ConsentState.Unknown],
      }).then(async (allDms: Dm[]) => {
        conversations = (await Promise.all(allDms.map(dm => this.normalizeDmConversation(dm, address)))).filter(Boolean) as NormalizedConversation[];
        // Sort by latest message timestamp (newest first)
        conversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        observer.next([...conversations]);

        // Start streaming new conversations
        conversationStreamSubscription = this.client.conversations.stream({
          onValue: async (conversation) => {
            if (conversation instanceof Dm && !closed) {
              const normalized = await this.normalizeDmConversation(conversation, address);
              if (normalized && !conversations.some(c => c.id === normalized.id)) {
                conversations = [...conversations, normalized];
                // Sort by latest message timestamp (newest first)
                conversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                observer.next([...conversations]);
              }
            }
          },
          onError: (error) => {
            observer.error(error);
          },
          onFail: () => {
            observer.error(new Error('Conversation stream failed'));
          }
        });

        // Subscribe to global message stream to update latest message content and timestamps
        allMessagesSubscription = this.streamAllMessages(address).subscribe({
          next: (newMessage) => {
            if (!closed) {
              this.updateConversationWithNewMessage(conversations, newMessage, address).then(updated => {
                if (updated) {
                  // Sort by latest message timestamp (newest first)
                  conversations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                  observer.next([...conversations]);
                }
              });
            }
          },
          error: (error) => {
            console.error('Error in message stream for conversation list:', error);
            // Don't fail the entire observable for message stream errors
          }
        });

      }).catch(err => observer.error(err));

      // Teardown logic
      return () => {
        closed = true;
        if (conversationStreamSubscription) {
          // Note: XMTP streams don't have unsubscribe, they use the closed flag
        }
        if (allMessagesSubscription) {
          allMessagesSubscription.unsubscribe();
        }
      };
    });
  }

  /**
   * Streams all messages from all allowed conversations
   * @returns Observable emitting normalized messages as they arrive in real-time
   * @throws Error if client connection fails, no active inbox ID found, or message normalization fails
   */
  streamAllMessages(walletAddress: `0x${string}`): Observable<NormalizedMessage> {
    const activeInboxId = this.client.inboxId;
    if (!activeInboxId) throw new Error('No active inbox ID found');

    return new Observable<NormalizedMessage>(observer => {
      let closed = false;

      this.client.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed, ConsentState.Unknown],
        onValue: async (message) => {
          if (!closed) {
            try {
              const normalized = await this.normalizeMessage(message as DecodedMessage, activeInboxId);
              const conversation = await this.client.conversations.getConversationById(message.conversationId);
              const members = await conversation?.members();
              const senderAddress = members?.find(member => member.accountIdentifiers[0]?.identifier.toLowerCase() !== walletAddress.toLowerCase())?.accountIdentifiers[0]?.identifier.toLowerCase();
              observer.next({ ...normalized, senderAddress } as NormalizedMessage);
            } catch (error) {
              console.error('Error normalizing streamed message:', error);
            }
          }
        },
        onError: (error) => {
          observer.error(error);
        },
        onFail: () => {
          observer.error(new Error('All messages stream failed'));
        }
      }).catch(err => observer.error(err));

      // Teardown logic
      return () => { closed = true; };
    }).pipe(share());
  }

  /**
   * Gets the most recent 100 messages from a conversation and streams new ones as they arrive
   * @param conversationId The ID of the conversation to fetch and stream
   * @returns Observable emitting normalized conversation with messages, sorted by timestamp (newest first)
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

        // Initial fetch of messages
        const initialMessages = await conversation.messages({ limit: BigInt(100), direction: SortDirection.Descending });
        messages = await Promise.all(initialMessages.map(message => this.normalizeMessage(message as DecodedMessage, activeInboxId)));
        // Sort newest first
        messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        observer.next({ ...conversationInfo, messages: [...messages] });

        // Start streaming new messages from this specific conversation
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
   * Checks if a message belongs to a specific conversation
   * @param message The normalized message to check
   * @param conversation The conversation info to check against
   * @param currentAddress The current user's Ethereum address
   * @returns boolean indicating if the message belongs to the conversation
   */
  private isMessageFromConversation(message: NormalizedMessage, conversation: NormalizedConversation, currentAddress: string): boolean {
    // For DMs, check if the message sender is one of the conversation participants
    const conversationParticipants = [
      currentAddress.toLowerCase(),
      ...conversation.members.map(m => m.identifier.toLowerCase())
    ];

    // We need to get the sender's address from their inbox ID
    // For now, we'll use a simple approach and check if the sender inbox ID matches
    // the conversation's peer inbox ID or is the current user
    return message.senderInboxId === conversation.peerInboxId || message.self;
  }

  /**
   * Updates a conversation in the list with new message information
   * @param conversations The array of conversations to update
   * @param newMessage The new message that arrived
   * @param currentAddress The current user's Ethereum address
   * @returns Promise resolving to boolean indicating if any conversation was updated
   */
  private async updateConversationWithNewMessage(conversations: NormalizedConversation[], newMessage: NormalizedMessage, currentAddress: string): Promise<boolean> {
    let updated = false;

    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];

      // Check if this message belongs to this conversation
      if (this.isMessageFromConversation(newMessage, conversation, currentAddress)) {
        // Update the conversation with the latest message info
        conversations[i] = {
          ...conversation,
          timestamp: newMessage.timestamp,
          latestMessageContent: newMessage.content
        };
        updated = true;
        break; // A message can only belong to one conversation
      }
    }

    return updated;
  }

  /**
   * Normalizes a DM conversation into a standard format
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
      const latestMessageContent = (latestMessage?.content || latestMessage?.fallback || '') as string;

      // console.log({members, consentState, peerInboxId, latestMessageContent});

      return {
        id: dm.id,
        timestamp: new Date(Number(latestMessage?.sentAtNs || dm.createdAtNs) / 1000000),
        peerInboxId,
        consentState,
        latestMessageContent,
        members: members.map(member => ({
          identifier: member.accountIdentifiers[0].identifier.toLowerCase(),
          identifierKind: member.accountIdentifiers[0].identifierKind,
        }))
      };
    } catch (err) {
      console.error('Failed to normalize DM:', err, dm);
      return null;
    }
  }

  /**
   * Normalizes a message into a standard format
   * @param message The XMTP message to normalize
   * @param activeInboxId The current user's inbox ID to determine if message is from self
   * @returns Promise resolving to normalized message with proper content handling
   */
  async normalizeMessage(message: DecodedMessage, activeInboxId: string): Promise<NormalizedMessage> {
    let content: string;
    const isSelf = message.senderInboxId === activeInboxId;

        // Handle different content types
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (typeof message.content === 'object' && message.content !== null) {
      // Handle system messages based on content type
      switch (message.contentType.typeId) {
        case 'group_updated':
          content = this.formatGroupUpdateMessage(message.content as any);
          break;
        default:
          // For unknown object types, use fallback or stringify
          content = message.fallback || JSON.stringify(message.content);
      }
    } else {
      // Fallback for null/undefined content
      content = message.fallback || '[Empty message]';
    }

    return {
      id: message.id,
      content: content,
      contentType: message.contentType,
      fallback: message.fallback,
      deliveryStatus: message.deliveryStatus,
      timestamp: new Date(Number(message.sentAtNs) / 1000000),
      senderInboxId: message.senderInboxId,
      self: isSelf,
      conversationId: message.conversationId,
    };
  }

  getRecipientAddress(conversation: NormalizedConversation, walletAddress: string | null | undefined) {
    return conversation.members?.filter(member => member?.identifier !== walletAddress)[0]?.identifier ?? '';
  }

  /**
   * Formats a group update message for display
   * @param content The group update content object
   * @returns Formatted string describing the group update
   */
  private formatGroupUpdateMessage(content: any): string {
    const parts: string[] = [];

    if (content.addedInboxes && content.addedInboxes.length > 0) {
      const count = content.addedInboxes.length;
      parts.push(`${count} member${count > 1 ? 's' : ''} added to the group`);
    }

    if (content.removedInboxes && content.removedInboxes.length > 0) {
      const count = content.removedInboxes.length;
      parts.push(`${count} member${count > 1 ? 's' : ''} removed from the group`);
    }

    if (content.metadataFieldChanges && content.metadataFieldChanges.length > 0) {
      parts.push('Group settings updated');
    }

    return parts.length > 0 ? parts.join(', ') : 'Group updated';
  }

  async checkIfUserIsOnNetwork(address: string): Promise<boolean> {
    try {
      const identifiers: Identifier[] = [{
        identifier: address,
        identifierKind: 'Ethereum',
      }];
      const response = await this.client.canMessage(identifiers);
      return response.get(address) ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Creates a new DM conversation with a specified Ethereum address
   * @param to The Ethereum address to start a conversation with
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
   * Checks if a conversation is with the agent wallet address
   * @param conversationId The ID of the conversation to check
   * @returns Promise resolving to boolean indicating if conversation is with agent
   */
  private async isAgentConversation(conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) return false;

      // For DM conversations, check members to find the peer
      if (conversation instanceof Object && 'members' in conversation) {
        const dm = conversation as Dm;
        try {
          const members = await dm.members();

          // Get current user address to filter out self
          const currentAddress = this.web3Svc.getCurrentAddress()?.toLowerCase();

          // Find the peer (not the current user)
          const peer = members.find(member =>
            member.accountIdentifiers[0]?.identifier.toLowerCase() !== currentAddress
          );

          if (peer) {
            const peerAddress = peer.accountIdentifiers[0].identifier.toLowerCase();
            const isAgent = peerAddress === this.AGENT_ADDRESS;
            return isAgent;
          }
        } catch (membersError) {
          console.error('Error getting DM members:', membersError);
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking if conversation is with agent:', error);
      return false;
    }
  }

  /**
   * Sends a message to a conversation with optional context for agent conversations
   * @param conversationId The ID of the conversation to send to
   * @param message The message content to send

   * @returns Promise resolving to the message ID
   * @throws Error if conversation not found or message sending fails
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
   * Sends a message to a conversation
   * @param conversationId The ID of the conversation
   * @param message The message content to send
   * @returns Promise resolving to the message ID
   * @throws Error if message sending fails
   */
  async sendMessageWithPageContext(conversationId: string, message: string): Promise<string> {
    try {
      return await this.sendMessageToConversation(conversationId, message);
    } catch (error) {
      console.error('❌ Error in sendMessageWithPageContext:', error);
      throw error;
    }
  }

  /**
   * Creates a signer for XMTP using the wallet client
   * @param walletClient The wallet client to create signer from
   * @returns Signer object compatible with XMTP client
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
   * Creates an encryption key from a passcode and address using PBKDF2
   * @param passcode User's passcode for encryption
   * @param address User's Ethereum address
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
   * @param passcode Passcode for deriving the encryption key
   * @param address User's Ethereum address
   * @returns Promise resolving to encryption key as Uint8Array or undefined if no passcode
   * @throws Error if no XMTP identity exists for the address or key derivation fails
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
   * @param address User's Ethereum address
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
   * Creates a cryptographically secure random salt
   * @returns New random salt as Uint8Array
   */
  private createSalt(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Gets the stored salt for a user
   * @param address User's Ethereum address
   * @returns Promise resolving to salt as Uint8Array or undefined if no salt exists
   */
  private async getSalt(address: `0x${string}`): Promise<Uint8Array | undefined> {
    const userSalt = await this.storageSvc.getItem<string>(`user-salt-${address}`, true);
    if (userSalt) return this.utilSvc.base64ToUint8Array(userSalt);
    return;
  }

  /**
   * Checks if a user has required encryption parameters stored
   * @param address User's Ethereum address
   * @returns Promise resolving to boolean indicating if salt exists
   */
  async hasStoredUserSalt(address: `0x${string}`): Promise<boolean> {
    const userSalt = await this.getSalt(address);
    return !!userSalt;
  }
}
