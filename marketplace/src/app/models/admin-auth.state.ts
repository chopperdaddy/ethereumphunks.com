export interface AdminAuthState {
  // Admin access
  hasAdminAccess: boolean;
  adminCollections: string[];

  // Collection selection
  selectedCollectionSlug: string | null;

  // Session state
  adminSessionActive: boolean;
  adminSessionExpiry: number | null;
}

export const initialAdminAuthState: AdminAuthState = {
  hasAdminAccess: false,
  adminCollections: [],
  selectedCollectionSlug: null,
  adminSessionActive: false,
  adminSessionExpiry: null,
};
