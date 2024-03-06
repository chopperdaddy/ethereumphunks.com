import { createSelector } from '@ngrx/store';

import { GlobalState, ChatState } from '@/models/global-state';

export const selectChatState = (state: GlobalState) => state.chatState;

export const selectChatActive = createSelector(
  selectChatState,
  (state: ChatState) => state.active
);

export const selectChatConnected = createSelector(
  selectChatState,
  (state: ChatState) => state.connected
);

export const selectConversations = createSelector(
  selectChatState,
  (state: ChatState) => state.conversations
);

export const selectActiveConversation = createSelector(
  selectChatState,
  (state: ChatState) => state.activeConversation
);

export const selectToUser = createSelector(
  selectChatState,
  (state: ChatState) => state.toUser
);
