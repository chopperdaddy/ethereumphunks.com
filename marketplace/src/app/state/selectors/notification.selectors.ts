import { createSelector } from '@ngrx/store';

import { GlobalState, NotificationState } from '@/models/global-state';

export const selectNotificationState = (state: GlobalState) => state.notificationState;

export const selectNotifications = createSelector(
  selectNotificationState,
  (appState: NotificationState) => appState.notifications
);

export const selectNotifHoverState = createSelector(
  selectNotificationState,
  (appState: NotificationState) => appState.notifHoverState
);
