import { Action, ActionReducer, createReducer, on } from '@ngrx/store';
import { AdminAuthState, initialAdminAuthState } from '../../models/admin-auth.state';
import * as actions from './admin-auth-state.actions';

export const adminAuthStateReducer: ActionReducer<AdminAuthState, Action> = createReducer(
  initialAdminAuthState,

  // Reset state
  on(actions.resetAdminState, () => initialAdminAuthState),

  // Admin access
  on(actions.setAdminAccess, (state, { hasAdminAccess, adminCollections }) => ({
    ...state,
    hasAdminAccess,
    adminCollections,
    // Auto-select collection if only one available
    selectedCollectionSlug: adminCollections.length === 1 ? adminCollections[0] : state.selectedCollectionSlug
  })),

  // Collection selection
  on(actions.setSelectedCollectionSlug, (state, { collectionSlug }) => ({
    ...state,
    selectedCollectionSlug: collectionSlug
  })),

  // Session management
  on(actions.setAdminSession, (state, { sessionActive, sessionExpiry }) => ({
    ...state,
    adminSessionActive: sessionActive,
    adminSessionExpiry: sessionExpiry
  })),

  on(actions.clearAdminSession, (state) => ({
    ...state,
    adminSessionActive: false,
    adminSessionExpiry: null
  })),

  // Restore from storage
  on(actions.setAdminAuthFromStorage, (state, { collectionSlug, sessionExpiry }) => ({
    ...state,
    selectedCollectionSlug: collectionSlug,
    adminSessionActive: true,
    adminSessionExpiry: sessionExpiry,
    hasAdminAccess: true,
    // Include the collection they had a session for in adminCollections
    adminCollections: state.adminCollections.includes(collectionSlug)
      ? state.adminCollections
      : [...state.adminCollections, collectionSlug]
  }))
);
