import { AppState, ChatState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from '../actions/chat.actions';

export const initialState: ChatState = {
  active: false,
  connected: false,
  conversations: [],
  activeConversation: null,
  toUser: null,
};

export const chatReducer: ActionReducer<ChatState, Action> = createReducer(
  initialState,
  on(actions.setChatActive, (state, { active }) => {
    return { ...state, active };
  }),
  on(actions.setChatConnected, (state, { connected }) => {
    return { ...state, connected };
  }),
  on(actions.setConversations, (state, { conversations }) => {
    return { ...state, conversations };
  }),
  on(actions.setActiveConversation, (state, { activeConversation }) => {
    return { ...state, activeConversation };
  }),
  on(actions.setToUser, (state, { address }) => {
    return { ...state, toUser: address };
  }),
);
