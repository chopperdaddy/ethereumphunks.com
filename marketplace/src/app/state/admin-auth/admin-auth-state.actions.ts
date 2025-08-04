import { createAction, props } from '@ngrx/store';

export const setAdminAccess = createAction(
  '[Admin Auth] Set Admin Access',
  props<{
    hasAdminAccess: boolean;
    adminCollections: string[];
  }>()
);

// Collection selection actions
export const setSelectedCollectionSlug = createAction(
  '[Admin Auth] Set Selected Collection Slug',
  props<{ collectionSlug: string | null }>()
);

// Session management actions
export const setAdminSession = createAction(
  '[Admin Auth] Set Admin Session',
  props<{
    sessionActive: boolean;
    sessionExpiry: number | null;
  }>()
);

export const clearAdminSession = createAction(
  '[Admin Auth] Clear Admin Session'
);

export const resetAdminState = createAction(
  '[Admin Auth] Reset Admin State'
);

export const setAdminAuthFromStorage = createAction(
  '[Admin Auth] Set Admin Auth From Storage',
  props<{
    collectionSlug: string;
    sessionExpiry: number;
  }>()
);
