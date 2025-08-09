import { createAction, props } from '@ngrx/store';
import { NormalizedConversation, NormalizedConversationWithMessages } from '@/models/chat';

export const setChatConnected = createAction(
  '[Chat] Set Chat Connected',
  props<{ connected: boolean, activeInboxId: string | undefined }>()
);

export const setChatActive = createAction(
  '[Chat] Set Chat Active',
  props<{ active: boolean, activeConversationId?: string | null }>()
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
  props<{ conversation: NormalizedConversationWithMessages | undefined }>()
);

export const setCreateConversationWithAddress = createAction(
  '[Chat] Set Create Conversation With Address',
  props<{ address: string }>()
);
