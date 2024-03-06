import { createAction, props } from '@ngrx/store';
import { Conversation } from '@xmtp/xmtp-js';

export const setChatActive = createAction(
  '[Chat] Set Chat Active',
  props<{ active: boolean }>()
);

export const setChatConnected = createAction(
  '[Chat] Set Chat Connected',
  props<{ connected: boolean }>()
);

export const setConversations = createAction(
  '[Chat] Set Conversations',
  props<{ conversations: Conversation[] }>()
);

export const setActiveConversation = createAction(
  '[Chat] Set Active Conversation',
  props<{ activeConversation: Conversation }>()
);

export const setToUser = createAction(
  '[Chat] Set To User',
  props<{ address: string | null }>()
);
