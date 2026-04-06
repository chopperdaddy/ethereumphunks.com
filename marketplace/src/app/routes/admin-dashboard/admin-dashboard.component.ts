import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Store } from '@ngrx/store';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { PhunkGridComponent } from "@/components/phunk-grid/phunk-grid.component";

import { GlobalState } from '@/models/global-state';
import * as adminAuthSelectors from '@/state/admin-auth/admin-auth-state.selectors';
import * as adminAuthActions from '@/state/admin-auth/admin-auth-state.actions';

import { AdminAuthService } from '@/services/admin-auth.service';

import { environment } from '@environments/environment';
import * as appStateSelectors from '@/state/app/app-state.selectors';
import { SortOption } from '@/models/sorts.model';
import { DataService } from '@/services/data.service';
import { filter, map, startWith, switchMap, tap } from 'rxjs';

interface SlotState {
  metadata: {
    update: boolean;
    generate: boolean;
  };
}

const initialSlotState: SlotState = {
  metadata: {
    update: false,
    generate: false,
  },
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    PhunkGridComponent,
  ],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {

  sortOption = SortOption;

  private store = inject(Store<GlobalState>);
  private adminAuthSvc = inject(AdminAuthService);
  private dataSvc = inject(DataService);

  // Convert NgRx state to signals
  hasAdminAccess = toSignal(this.store.select(adminAuthSelectors.selectHasAdminAccess));
  adminCollections = toSignal(this.store.select(adminAuthSelectors.selectAdminCollections));
  selectedCollectionSlug = toSignal(this.store.select(adminAuthSelectors.selectSelectedCollectionSlug));
  adminSessionActive = toSignal(this.store.select(adminAuthSelectors.selectAdminSessionActive));
  adminSessionExpiry = toSignal(this.store.select(adminAuthSelectors.selectAdminSessionExpiry));
  isAuthenticated = toSignal(this.store.select(adminAuthSelectors.selectIsAdminAuthenticated));
  sessionTimeRemaining = toSignal(this.store.select(adminAuthSelectors.selectSessionTimeRemaining));
  sessionExpired = toSignal(this.store.select(adminAuthSelectors.selectSessionExpired));

  phunkData$ = toObservable(this.selectedCollectionSlug).pipe(
    filter((collectionSlug) => !!collectionSlug),
    switchMap((collectionSlug) => this.dataSvc.fetchAllWithPagination(collectionSlug!, 0, 44, {}, this.sortOption.ID)),
    map((data) => data.data),
    startWith([])
  );

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

  slotsState = signal<SlotState>(initialSlotState);

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

  async generateCollectionMetadata() {

    this.slotsState.set({
      ...this.slotsState(),
      metadata: {
        update: false,
        generate: true,
      },
    });

    // const collectionSlug = this.selectedCollectionSlug();
    // if (collectionSlug) {
    //   try {
    //     const response = await this.adminAuthSvc.makeAdminRequest(`${environment.relayUrl}/collection-admin/generate-collection-metadata`, { slug: collectionSlug });
    //     console.log('Collection metadata generated:', response);
    //   } catch (error) {
    //     console.error('Failed to generate collection metadata:', error);
    //   }
    // }
  }

  async updateCollectionMetadata() {
    this.slotsState.set({
      ...this.slotsState(),
      metadata: {
        update: true,
        generate: false,
      },
    });
  }
}
