import { createAction, props } from '@ngrx/store';
import { NormalizedConversation, NormalizedConversationWithMessages } from '@/models/chat';
import { UnreadConversations } from '@/models/global-state';

export const setChat = createAction(
  '[Chat] Set Chat Active',
  props<{ active: boolean, activeConversationId?: string | null }>()
);

export const setChatConnected = createAction(
  '[Chat] Set Chat Connected',
  props<{ connected: boolean, activeInboxId: string | undefined }>()
);

export const setHasAccount = createAction(
  '[Chat] Has Account',
  props<{ hasAccount: boolean }>()
);

export const setConversations = createAction(
  '[Chat] Set Conversations',
  props<{ conversations: NormalizedConversation[] }>()
);

export const setActiveConversation = createAction(
  '[Chat] Set Active Conversation',
  props<{ conversation: NormalizedConversationWithMessages | null }>()
);

export const setCreateConversationWithAddress = createAction(
  '[Chat] Set Create Conversation With Address',
  props<{ address: string }>()
);

export const setUnreadConversations = createAction(
  '[Chat] Set Unread Conversations',
  props<{ unreadConversations: UnreadConversations }>()
);

export const clearUnreadForConversation = createAction(
  '[Chat] Clear Unread For Conversation',
  props<{ conversationId: string }>()
);
