import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Client, Conversation } from '@xmtp/xmtp-js';

import { Observable } from 'rxjs';

import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from './web3.service';
import { UtilService } from './util.service';

import { upsertNotification } from '@/state/actions/notification.actions';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  ENCODING: any = 'binary';

  client!: Client;

  clientOptions: any = {
    env: 'production',
  };

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private utilSvc: UtilService
  ) {}

  async signInToXmtp(): Promise<boolean> {
    try {
      const signer = await this.web3Svc.getActiveWalletClient();
      const address = signer?.account.address;

      console.log({ address });
      if (!address) throw new Error('No address found');

      let keys = this.loadKeys(address);
      if (!keys) {
        keys = await Client.getKeys(signer as any, {
          ...this.clientOptions
        });
        this.storeKeys(address, keys);
      }

      this.client = await Client.create(null, {
        ...this.clientOptions,
        privateKeyOverride: keys
      });

      this.streamAllMessages();

      if (this.client) return true;
    } catch (error) {
      console.error('Error signing in to XMTP', error);
    }

    return false;
  }

  async reconnectXmtp(address: string): Promise<boolean> {
    let keys = this.loadKeys(address);
    if (!keys) return false;

    this.client = await Client.create(null, {
      ...this.clientOptions,
      privateKeyOverride: keys
    });

    this.streamAllMessages();

    if (this.client) return true;
    return false;
  }

  async createConversationWithUser(userAddress: string): Promise<Conversation> {
    if (!this.client) await this.signInToXmtp();
    const conversation = await this.client.conversations.newConversation(userAddress);
    return conversation;
  }

  async getChatMessagesFromConversation(conversation: Conversation): Promise<any> {
    const messages = await conversation.messages();
    return messages;
  }

  async checkCanMessageUser(userAddress: string): Promise<boolean> {
    const canMessage = await this.client.canMessage(userAddress);
    return canMessage;
  }

  async getContacts(): Promise<any> {
    return this.client.contacts;
  }

  async sendMessageToConversation(
    conversation: Conversation,
    message: string | null
  ): Promise<void> {
    if (!message) return;
    await conversation.send(message);
  }

  async sendMessage(
    user: string,
    message: string | null
  ) {
    if (!message) return;
    if (!this.client) await this.signInToXmtp();

    const conversations = await this.getConversations();
    const conversation = conversations.filter(
      (conv) => conv.peerAddress.toLowerCase() === user.toLowerCase()
    )[0];

    console.log({ user, message, conversation, conversations });
    await this.sendMessageToConversation(conversation, message);
  }

  streamMessages(conversation: Conversation): Observable<any> {
    return new Observable(subscriber => {
      (async () => {
        for await (const message of await conversation.streamMessages()) {
          subscriber.next(message);
        }
      })().catch(err => subscriber.error(err));
      // Return a teardown logic if needed
      return () => {
        // Teardown logic here
      };
    });
  }

  async getConversations(): Promise<Conversation[]> {
    if (!this.client) await this.signInToXmtp();

    const conversations = await this.client.conversations.list();
    return conversations;
  }

  async streamAllMessages() {
    for await (const message of await this.client.conversations.streamAllMessages()) {
      if (message.senderAddress === this.client.address) continue;

      const isOld = new Date(message.sent).getTime() < (new Date().getTime() - 10000);
      if (isOld) continue;

      let notification: Notification = {
        id: this.utilSvc.createIdFromString(message.id),
        timestamp: new Date(message.sent).getTime(),
        type: 'chat',
        function: 'chatMessage',
        chatAddress: message.senderAddress,
      };

      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  keysExist(address: string): boolean {
    return !!this.loadKeys(address);
  }

  // DEV ONLY ========================================== //
  // Utility functions for storing keys in local storage //

  private getEnv = (): "dev" | "production" | "local" => {
    return "production";
  };

  private buildLocalStorageKey = (walletAddress: string) => {
    walletAddress = walletAddress.toLowerCase();
    return walletAddress ? `xmtp:${this.getEnv()}:keys:${walletAddress}` : "";
  }

  private loadKeys = (walletAddress: string): Uint8Array | null => {
    walletAddress = walletAddress.toLowerCase();
    const val = sessionStorage.getItem(this.buildLocalStorageKey(walletAddress));
    return val ? Buffer.from(val, this.ENCODING) : null;
  };

  private storeKeys = (walletAddress: string, keys: Uint8Array) => {
    walletAddress = walletAddress.toLowerCase();
    sessionStorage.setItem(
      this.buildLocalStorageKey(walletAddress),
      Buffer.from(keys).toString(this.ENCODING),
    );
  };

  private wipeKeys = (walletAddress: string) => {
    walletAddress = walletAddress.toLowerCase();
    // This will clear the conversation cache + the private keys
    sessionStorage.removeItem(this.buildLocalStorageKey(walletAddress));
  };
}
