import { ChatState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from './chat.actions';

export const initialState: ChatState = {
  connected: false,
  activeInboxId: undefined,

  active: false,
  activeConversationId: undefined,

  activeConversation: null,

  hasAccount: false,
  conversations: null,
};

export const chatReducer: ActionReducer<ChatState, Action> = createReducer(
  initialState,
  on(actions.setChatConnected, (state, { connected, activeInboxId }) => {
    return { ...state, connected, activeInboxId };
  }),
  on(actions.setChatActive, (state, { active, activeConversationId }) => {
    return { ...state, active, activeConversationId: activeConversationId };
  }),
  on(actions.setHasAccount, (state, { hasAccount }) => {
    return { ...state, hasAccount };
  }),
  on(actions.setConversations, (state, { conversations }) => {
    return { ...state, conversations };
  }),
  on(actions.setActiveConversation, (state, { conversation }) => {
    return { ...state, activeConversation: conversation ?? null };
  }),
);
