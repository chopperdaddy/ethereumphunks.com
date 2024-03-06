import { AppState, NotificationState } from '@/models/global-state';
import { Action, ActionReducer, createReducer, on } from '@ngrx/store';

import * as actions from '../actions/notification.actions';

export const initialState: NotificationState = {
  notifications: [],
  notifHoverState: {},
};

export const notificationReducer: ActionReducer<NotificationState, Action> = createReducer(
  initialState,
  on(actions.removeNotification, (state, { txId }) => {
    const removeTransaction = {
      ...state,
      notifications: state.notifications.map(tx => tx.id === txId ? { ...tx, dismissed: true } : tx)
    };
    return removeTransaction
  }),
  on(actions.upsertNotification, (state, { notification }) => {
    const txns = [...state.notifications];
    const index = txns.findIndex(tx => tx.id === notification.id);
    if (index > -1) txns.splice(index, 1, notification);
    else txns.push(notification);
    const upsertNotification = {
      ...state,
      notifications: txns
    };
    return upsertNotification
  }),
  on(actions.clearNotifications, (state) => {
    const clearTransactions = {
      ...state,
      notifications: []
    };
    return clearTransactions
  }),
  on(actions.setNotifications, (state, { notifications }) => {
    const setTransactions = {
      ...state,
      notifications
    };
    return setTransactions
  }),
  on(actions.setNotifHoverState, (state, { notifHoverState }) => {
    const setNotifHoverState = {
      ...state,
      notifHoverState
    };
    return setNotifHoverState
  }),
);
