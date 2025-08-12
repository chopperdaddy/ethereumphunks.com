import { createSelector } from '@ngrx/store';

import { GlobalState, ChatState } from '@/models/global-state';

export const selectChatState = (state: GlobalState) => state.chatState;

export const selectChatConnected = createSelector(
  selectChatState,
  (state: ChatState) => ({ connected: state.connected, activeInboxId: state.activeInboxId })
);

export const selectChat = createSelector(
  selectChatState,
  (state: ChatState) => ({ active: state.active, activeConversationId: state.activeConversationId })
);

export const selectHasAccount = createSelector(
  selectChatState,
  (state: ChatState) => state.hasAccount
);

export const selectConversations = createSelector(
  selectChatState,
  (state: ChatState) => state.conversations
);

export const selectActiveConversation = createSelector(
  selectChatState,
  (state: ChatState) => state.activeConversation
);

export const selectUnreadConversations = createSelector(
  selectChatState,
  (state: ChatState) => state.unreadConversations
);

export const selectUnreadCount = createSelector(
  selectChatState,
  (state: ChatState) => state.unreadCount
);
