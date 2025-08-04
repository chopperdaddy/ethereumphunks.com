import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import { GlobalState } from '@/models/global-state';
import * as adminAuthSelectors from '@/state/admin-auth/admin-auth-state.selectors';
import * as adminAuthActions from '@/state/admin-auth/admin-auth-state.actions';

import { AdminAuthService } from '@/services/admin-auth.service';

import { environment } from '@environments/environment';
import * as appStateSelectors from '@/state/app/app-state.selectors';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {

  private store = inject(Store<GlobalState>);
  private adminAuthSvc = inject(AdminAuthService);

  // Convert NgRx state to signals
  hasAdminAccess = toSignal(this.store.select(adminAuthSelectors.selectHasAdminAccess));
  adminCollections = toSignal(this.store.select(adminAuthSelectors.selectAdminCollections));
  selectedCollectionSlug = toSignal(this.store.select(adminAuthSelectors.selectSelectedCollectionSlug));
  adminSessionActive = toSignal(this.store.select(adminAuthSelectors.selectAdminSessionActive));
  adminSessionExpiry = toSignal(this.store.select(adminAuthSelectors.selectAdminSessionExpiry));
  isAuthenticated = toSignal(this.store.select(adminAuthSelectors.selectIsAdminAuthenticated));
  sessionTimeRemaining = toSignal(this.store.select(adminAuthSelectors.selectSessionTimeRemaining));
  sessionExpired = toSignal(this.store.select(adminAuthSelectors.selectSessionExpired));
  isBrowserActive = toSignal(this.store.select(appStateSelectors.selectIsBrowserActive));
  // Computed signals for derived state
  canShowMenu = computed(() => this.hasAdminAccess() && this.isAuthenticated());

  sessionStatus = computed(() => {
    if (!this.adminSessionActive()) return 'No Session';
    if (this.sessionExpired()) return 'Session Expired';
    const timeRemaining = this.sessionTimeRemaining();
    if (timeRemaining) {
      const minutes = Math.floor(timeRemaining / (1000 * 60));
      return `Session Active (${minutes}m remaining)`;
    }
    return 'Session Active';
  });

  adminStatus = computed(() => {
    if (!this.hasAdminAccess()) return 'No Admin Access';
    const collections = this.adminCollections();
    if (!collections || collections.length === 0) return 'No Collections Available';
    return `Admin Access (${collections.length} collections)`;
  });

  selectCollection(collectionSlug: string) {
    this.store.dispatch(adminAuthActions.setSelectedCollectionSlug({ collectionSlug }));
  }

  async signIn() {
    const collectionSlug = this.selectedCollectionSlug();
    if (collectionSlug) {
      try {
        await this.adminAuthSvc.signLoginMessage(collectionSlug);
      } catch (error) {
        console.error('Failed to sign in:', error);
      }
    }
  }

  async logout() {
    await this.adminAuthSvc.logout();
  }

  clearAllTokens() {
    this.adminAuthSvc.clearAllAdminTokens();
  }

  async generateCollectionMetadata() {
    const collectionSlug = this.selectedCollectionSlug();
    if (collectionSlug) {
      try {
        const response = await this.adminAuthSvc.makeAdminRequest(`${environment.relayUrl}/collection-admin/generate-collection-metadata`, { slug: collectionSlug });
        console.log('Collection metadata generated:', response);
      } catch (error) {
        console.error('Failed to generate collection metadata:', error);
      }
    }
  }

  async addAttributesToDb() {
    const collectionSlug = this.selectedCollectionSlug();
    if (collectionSlug) {
      try {
        const response = await this.adminAuthSvc.makeAdminRequest(`${environment.relayUrl}/collection-admin/add-attributes-to-db`, { slug: collectionSlug });
        console.log('Collection metadata generated:', response);
      } catch (error) {
        console.error('Failed to add attributes to db:', error);
      }
    }
  }

  async addFiltersFile() {
    const collectionSlug = this.selectedCollectionSlug();
    if (collectionSlug) {
      try {
        const response = await this.adminAuthSvc.makeAdminRequest(`${environment.relayUrl}/collection-admin/add-filters-file`, { slug: collectionSlug });
        console.log('Filters file added:', response);
      } catch (error) {
        console.error('Failed to add filters file:', error);
      }
    }
  }
}
