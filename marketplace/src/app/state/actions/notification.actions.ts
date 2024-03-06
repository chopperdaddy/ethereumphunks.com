import { createAction, props } from '@ngrx/store';

import { Notification, NotificationState } from '@/models/global-state';

export const clearNotifications = createAction(
  '[App State] Clear Notifications',
);

export const upsertNotification = createAction(
  '[App State] Upsert Notification',
  props<{ notification: Notification }>()
);

export const removeNotification = createAction(
  '[App State] Remove Notification',
  props<{ txId: Notification['id'] }>()
);

export const setNotifications = createAction(
  '[App State] Set Notifications',
  props<{ notifications: Notification[] }>()
);

export const setNotifHoverState = createAction(
  '[App State] Set Notif Hover State',
  props<{ notifHoverState: NotificationState['notifHoverState'] }>()
);
