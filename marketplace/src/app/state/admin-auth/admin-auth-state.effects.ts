import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, filter, from, map, of, switchMap, distinctUntilChanged, merge } from 'rxjs';

import { environment } from '@environments/environment';

import { GlobalState } from '@/models/global-state';

import * as adminAuthActions from './admin-auth-state.actions';
import { setConnected, setWalletAddress } from '../app/app-state.actions';

@Injectable()
export class AdminAuthStateEffects {

  // Reset admin state when wallet disconnects
  resetAdminStateOnWalletDisconnect$ = createEffect(() => this.actions$.pipe(
    ofType(setConnected),
    filter((action: any) => !action.connected),
    map(() => adminAuthActions.resetAdminState())
  ));

  // Reset admin state when wallet address is cleared
  resetAdminStateOnWalletAddressCleared$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    filter((action: any) => !action.walletAddress),
    map(() => adminAuthActions.resetAdminState())
  ));

  // Admin access checking effect + token restoration
  checkAdminAccess$ = createEffect(() => this.actions$.pipe(
    ofType(setWalletAddress),
    distinctUntilChanged((prev, curr) => prev.walletAddress === curr.walletAddress),
    filter((action: any) => !!action.walletAddress),
    switchMap(({ walletAddress }) => {
      if (!walletAddress) {
        return of(adminAuthActions.setAdminAccess({
          hasAdminAccess: false,
          adminCollections: []
        }));
      }

      // Check admin access from backend
      const adminAccessCheck$ = this.http.post<{
        success: boolean;
        collections?: string[];
        hasAdminAccess?: boolean;
      }>(`${environment.relayUrl}/auth/check-admin-collections`, { address: walletAddress }).pipe(
        map((response) => {

          if (response.success) {
            return adminAuthActions.setAdminAccess({
              hasAdminAccess: response.hasAdminAccess || false,
              adminCollections: response.collections || []
            });
          } else {
            return adminAuthActions.setAdminAccess({
              hasAdminAccess: false,
              adminCollections: []
            });
          }
        }),
        catchError((error) => {
          console.error('🔧 Error checking admin access:', error);
          return of(adminAuthActions.setAdminAccess({
            hasAdminAccess: false,
            adminCollections: []
          }));
        })
      );

      // Check for stored tokens
      const tokenCheck$ = from(this.checkStoredAdminTokens()).pipe(
        filter(result => result !== null),
        map((result) => {
          return adminAuthActions.setAdminAuthFromStorage({
            collectionSlug: result!.collectionSlug,
            sessionExpiry: result!.sessionExpiry
          });
        }),
        catchError((error) => {
          console.error('❌ Error checking stored tokens:', error);
          return of(); // Empty observable, no actions emitted
        })
      );

      // Merge both observables into a single stream
      return merge(adminAccessCheck$, tokenCheck$);
    })
  ));

  /**
   * Checks localStorage for valid admin tokens
   */
  private checkStoredAdminTokens(): Promise<{ collectionSlug: string; sessionExpiry: number } | null> {
    return new Promise((resolve) => {
      try {
        // Get all localStorage keys and find admin tokens
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('admin_') && key.endsWith('_access_token')) {
            // Extract collection slug from key: admin_{collection}_access_token
            const collectionSlug = key.replace('admin_', '').replace('_access_token', '');

            // Try to load tokens for this collection
            const keyPrefix = `admin_${collectionSlug}`;
            const accessToken = localStorage.getItem(`${keyPrefix}_access_token`);
            const refreshToken = localStorage.getItem(`${keyPrefix}_refresh_token`);
            const expiry = localStorage.getItem(`${keyPrefix}_token_expiry`);

            if (accessToken && refreshToken && expiry) {
              const expiryTime = parseInt(expiry);
              if (expiryTime > Date.now()) {
                resolve({
                  collectionSlug,
                  sessionExpiry: expiryTime
                });
                return;
              } else {
                // Clean up expired tokens
                localStorage.removeItem(`${keyPrefix}_access_token`);
                localStorage.removeItem(`${keyPrefix}_refresh_token`);
                localStorage.removeItem(`${keyPrefix}_token_expiry`);
              }
            }
          }
        }
        resolve(null);
      } catch (error) {
        console.error('Error checking stored admin tokens:', error);
        resolve(null);
      }
    });
  }

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private http: HttpClient,
  ) {}
}
