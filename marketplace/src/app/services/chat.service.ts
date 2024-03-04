import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Client, Conversation } from '@xmtp/xmtp-js';

import { Observable } from 'rxjs';

import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from './web3.service';
import { upsertNotification } from '@/state/actions/app-state.actions';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  ENCODING: any = 'binary';

  client!: Client;

  constructor(
    private store: Store<GlobalState>,
    private readonly web3Svc: Web3Service
  ) {}

  async signInToXmtp(): Promise<void> {

    const clientOptions: any = {
      env: 'production',
    };

    const signer = await this.web3Svc.getActiveWalletClient();
    const address = signer?.account.address;
    if (!address) throw new Error('No address found');

    let keys = this.loadKeys(address);
    if (!keys) {
      keys = await Client.getKeys(signer, {
        ...clientOptions
      });
      this.storeKeys(address, keys);
    }

    this.client = await Client.create(null, {
      ...clientOptions,
      privateKeyOverride: keys
    });

    this.streamAllMessages();
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
      console.log(`New message from ${message.senderAddress}: ${message.content}`);

      const isOld = new Date(message.sent).getTime() < (new Date().getTime() - 10000);

      console.log({ isOld });

      let notification: Notification = {
        id: Date.now(),
        type: 'chat',
        function: 'chatMessage',
        chatAddress: message.senderAddress,
      };

      this.store.dispatch(upsertNotification({ notification }));
    }
  }


  // DEV ONLY ========================================== //
  // Utility functions for storing keys in local storage //

  getEnv = (): "dev" | "production" | "local" => {
    return "production";
  };

  buildLocalStorageKey = (walletAddress: string) =>
    walletAddress ? `xmtp:${this.getEnv()}:keys:${walletAddress}` : "";

  loadKeys = (walletAddress: string): Uint8Array | null => {
    const val = sessionStorage.getItem(this.buildLocalStorageKey(walletAddress));
    return val ? Buffer.from(val, this.ENCODING) : null;
  };

  storeKeys = (walletAddress: string, keys: Uint8Array) => {
    sessionStorage.setItem(
      this.buildLocalStorageKey(walletAddress),
      Buffer.from(keys).toString(this.ENCODING),
    );
  };

  wipeKeys = (walletAddress: string) => {
    // This will clear the conversation cache + the private keys
    sessionStorage.removeItem(this.buildLocalStorageKey(walletAddress));
  };
}
