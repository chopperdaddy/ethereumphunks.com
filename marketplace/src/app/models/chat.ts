import { ConsentState, Identifier, MessageDeliveryStatus, SafeContentTypeId } from '@xmtp/browser-sdk';

export interface NormalizedMessage {
  id: string;
  content: string;
  contentType: SafeContentTypeId;
  timestamp: Date;
  senderInboxId: string;
  self: boolean;
  conversationId: string;
  senderAddress?: string;
  fallback?: string;
  deliveryStatus?: MessageDeliveryStatus;
}

export type ViewType = 'conversations' | 'conversation' | 'login' | 'disabled';

export interface NormalizedConversation {
  id: string;
  timestamp: Date;
  peerInboxId: string;
  consentState: ConsentState;
  members: Identifier[];
  latestMessageContent: string;
  unreadCount?: number;
}

export interface NormalizedConversationWithMessages extends NormalizedConversation {
  messages: NormalizedMessage[];
}
