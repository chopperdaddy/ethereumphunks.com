import { createSelector } from '@ngrx/store';
import { AdminAuthState } from '../../models/admin-auth.state';
import { GlobalState } from '../../models/global-state';

// Base selector for admin auth state
export const selectAdminAuthState = (state: GlobalState) => state.adminAuthState;

// Basic selectors
export const selectHasAdminAccess = createSelector(
  selectAdminAuthState,
  (adminAuthState: AdminAuthState) => adminAuthState.hasAdminAccess
);

export const selectAdminCollections = createSelector(
  selectAdminAuthState,
  (adminAuthState: AdminAuthState) => adminAuthState.adminCollections
);

export const selectSelectedCollectionSlug = createSelector(
  selectAdminAuthState,
  (adminAuthState: AdminAuthState) => adminAuthState.selectedCollectionSlug
);

export const selectAdminSessionActive = createSelector(
  selectAdminAuthState,
  (adminAuthState: AdminAuthState) => adminAuthState.adminSessionActive
);

export const selectAdminSessionExpiry = createSelector(
  selectAdminAuthState,
  (adminAuthState: AdminAuthState) => adminAuthState.adminSessionExpiry
);

// Computed selectors
export const selectIsAdminAuthenticated = createSelector(
  selectAdminSessionActive,
  (sessionActive) => sessionActive
);

export const selectSelectedCollection = createSelector(
  selectSelectedCollectionSlug,
  selectAdminCollections,
  (selectedSlug, collections) => {
    if (!selectedSlug || !collections) return null;
    return collections.find(collection => collection === selectedSlug) || null;
  }
);

// Session-related computed selectors
export const selectSessionTimeRemaining = createSelector(
  selectAdminSessionExpiry,
  (sessionExpiry) => {
    if (!sessionExpiry) return null;
    const timeLeft = sessionExpiry - Date.now();
    return timeLeft > 0 ? timeLeft : 0;
  }
);

export const selectSessionExpired = createSelector(
  selectAdminSessionActive,
  selectSessionTimeRemaining,
  (sessionActive, timeRemaining) => {
    if (!sessionActive) return false;
    return timeRemaining !== null && timeRemaining <= 0;
  }
);
