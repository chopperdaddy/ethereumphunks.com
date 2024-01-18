import { createAction, props } from '@ngrx/store';

import { AppState, Cooldowns, EventType, Notification } from '@/models/global-state';

export const setConnected = createAction(
  '[App State] Set Wallet Connected',
  props<{ connected: boolean }>()
);

export const setWalletAddress = createAction(
  '[App State] Set Wallet Address',
  props<{ walletAddress: string }>()
);

export const checkHasWithdrawal = createAction(
  '[App State] Check Has Withdrawal'
);

export const setHasWithdrawal = createAction(
  '[App State] Has Withdrawal',
  props<{ hasWithdrawal: number }>()
);

export const resetAppState = createAction(
  '[App State] Reset App State'
);

export const setEventTypeFilter = createAction(
  '[Data State] Set Event Type',
  props<{ eventTypeFilter: EventType }>()
);

export const setMenuActive = createAction(
  '[App State] Set Menu Active',
  props<{ menuActive: AppState['menuActive'] }>()
);

export const setActiveMenuNav = createAction(
  '[App State] Set Active Menu Nav',
  props<{ activeMenuNav: AppState['activeMenuNav'] }>()
);

export const setSlideoutActive = createAction(
  '[App State] Set Slideout Active',
  props<{ slideoutActive: AppState['slideoutActive'] }>()
);

export const setTheme = createAction(
  '[App State] Set Theme',
  props<{ theme: AppState['theme'] }>()
);

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

export const setIsMobile = createAction(
  '[App State] Set Is Mobile',
  props<{ isMobile: boolean }>()
);

export const keyDownEscape = createAction(
  '[App State] Keydown Escape'
);

export const clickEvent = createAction(
  '[App State] Click Event',
  props<{ event: MouseEvent }>()
);

export const addCooldown = createAction(
  '[App State] Add Cooldown',
  props<{ cooldown: Cooldowns }>()
);

export const setCooldowns = createAction(
  '[App State] Set Cooldowns',
  props<{ cooldowns: Cooldowns }>()
);

export const setCurrentBlock = createAction(
  '[App State] Set Current Block',
  props<{ currentBlock: number }>()
);

export const setIndexerBlock = createAction(
  '[App State] Set Indexer Block',
  props<{ indexerBlock: number }>()
);

export const mouseUp = createAction(
  '[App State] Mouse Up',
  props<{ event: MouseEvent }>()
);

export const fetchUserPoints = createAction(
  '[App State] Fetch User Points'
);

export const setUserPoints = createAction(
  '[App State] Set User Points',
  props<{ userPoints: number }>()
);

export const fetchActiveMultiplier = createAction(
  '[App State] Fetch Active Multiplier'
);

export const setActiveMultiplier = createAction(
  '[App State] Set Active Multiplier',
  props<{ activeMultiplier: number }>()
);

export const restoreScrollPosition = createAction(
  '[Router] Restore Scroll Position',
  props<{ navigationId: number }>()
);

export const setNotifHoverState = createAction(
  '[App State] Set Notif Hover State',
  props<{ notifHoverState: AppState['notifHoverState'] }>()
);
