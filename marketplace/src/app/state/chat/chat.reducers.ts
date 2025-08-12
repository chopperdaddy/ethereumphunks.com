import { ChatState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from './chat.actions';

export const initialState: ChatState = {
  connected: false,
  activeInboxId: undefined,

  active: false,
  activeConversationId: null,

  activeConversation: null,

  hasAccount: false,
  conversations: null,

  unreadConversations: null,
  unreadCount: 0,
};

export const chatReducer: ActionReducer<ChatState, Action> = createReducer(
  initialState,
  on(actions.setChatConnected, (state, { connected, activeInboxId }) => {
    return { ...state, connected, activeInboxId };
  }),
  on(actions.setChat, (state, { active, activeConversationId }) => {
    return { ...state, active, activeConversationId: activeConversationId ?? null };
  }),
  on(actions.setHasAccount, (state, { hasAccount }) => {
    return { ...state, hasAccount };
  }),
  on(actions.setConversations, (state, { conversations }) => {
    return { ...state, conversations };
  }),
  on(actions.setActiveConversation, (state, { conversation }) => {
    return {
      ...state,
      activeConversation: conversation
    };
  }),
  on(actions.setUnreadConversations, (state, { unreadConversations }) => {
    return {
      ...state,
      unreadConversations,
      unreadCount: unreadConversations ? Object.values(unreadConversations).reduce((acc, count) => acc + count, 0) : 0
    };
  }),
  on(actions.clearUnreadForConversation, (state, { conversationId }) => {
    if (!state.unreadConversations?.[conversationId]) return state;
    const { [conversationId]: removed, ...remainingUnread } = state.unreadConversations;
    return {
      ...state,
      unreadConversations: remainingUnread,
      unreadCount: Object.values(remainingUnread).reduce((acc, count) => acc + count, 0)
    };
  }),
);
