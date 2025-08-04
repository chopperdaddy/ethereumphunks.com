import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { firstValueFrom, interval, Subscription, filter } from 'rxjs';

import { environment } from '@environments/environment';

import { Web3Service } from '@/services/web3.service';

import { GlobalState } from '@/models/global-state';

import * as adminAuthActions from '@/state/admin-auth/admin-auth-state.actions';
import * as adminAuthSelectors from '@/state/admin-auth/admin-auth-state.selectors';
import * as appStateSelectors from '@/state/app/app-state.selectors';

/** Data required for admin login verification */
interface LoginData {
  address: string;
  timestamp: number;
  nonce: string;
  collectionSlug: string;
}

/** Response from successful authentication */
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  collectionSlug: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenRefreshSubscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private web3Svc: Web3Service,
    private store: Store<GlobalState>
  ) {
    this.initializeTokenRefreshTimer();
    this.listenToAdminStateChanges();
  }

  /**
   * Generates a random nonce for the login message.
   * @returns A random hexadecimal string to be used as nonce.
   */
  generateNonce(): string {
    return Math.random().toString(16).substring(2, 15);
  }

  /**
   * Signs a login message to verify wallet ownership and create collection-specific JWT session.
   * Uses EIP-712 typed data signing for secure wallet verification.
   *
   * @param collectionSlug - The collection identifier for which admin access is being requested
   * @throws Error if wallet is not connected or signing fails
   */
  async signLoginMessage(collectionSlug: string): Promise<void> {
    try {
      const walletAddress = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
      if (!walletAddress) {
        throw new Error('No wallet address found');
      }

      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = this.generateNonce();

      // Create the typed data for collection-specific login verification
      const domain = {
        name: 'EtherPhunks Admin',
        version: '1',
        chainId: environment.chainId,
      };

      const types = {
        Login: [
          { name: 'message', type: 'string' },
          { name: 'collectionSlug', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'nonce', type: 'string' },
        ]
      };

      const message = {
        message: `Sign this message to verify you are an admin of the ${collectionSlug} collection`,
        collectionSlug: collectionSlug,
        timestamp: timestamp,
        nonce: nonce,
      };

      const typedData = {
        types,
        domain,
        message,
        primaryType: 'Login',
      };

      // Sign the typed data
      const { signature, address } = await this.web3Svc.signTypedMessage(typedData);
      if (!signature) {
        throw new Error('Failed to sign message');
      }

      // Send to backend for verification and JWT generation
      const authResponse = await this.authenticateWithBackend({
        address,
        timestamp,
        nonce,
        collectionSlug
      }, signature);

      // Store tokens and update session state
      this.storeTokens(authResponse.accessToken, authResponse.refreshToken, authResponse.expiresIn, collectionSlug);
      this.store.dispatch(adminAuthActions.setAdminSession({
        sessionActive: true,
        sessionExpiry: Date.now() + (authResponse.expiresIn * 1000)
      }));

      console.log(`Authentication successful for ${collectionSlug} collection, JWT session created`);

    } catch (error) {
      console.error('Error signing login message:', error);
      throw error;
    }
  }

  /**
   * Sends the signed login data to the backend for verification and JWT generation.
   *
   * @param loginData - The login data including address, timestamp, nonce, and collection
   * @param signature - The wallet signature of the typed data
   * @returns Promise resolving to the authentication response containing tokens
   */
  private async authenticateWithBackend(loginData: LoginData, signature: string): Promise<AuthResponse> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.relayUrl}/auth/verify-wallet`, {
        loginData,
        signature
      })
    );

    return response;
  }

  /**
   * Stores JWT tokens securely in memory and localStorage.
   * Tokens are stored with collection-specific keys.
   *
   * @param accessToken - The JWT access token
   * @param refreshToken - The JWT refresh token
   * @param expiresIn - Token expiration time in seconds
   * @param collectionSlug - Collection identifier for the tokens
   */
  private storeTokens(accessToken: string, refreshToken: string, expiresIn: number, collectionSlug: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    // Store in localStorage with collection-specific keys
    const keyPrefix = `admin_${collectionSlug}`;
    localStorage.setItem(`${keyPrefix}_access_token`, accessToken);
    localStorage.setItem(`${keyPrefix}_refresh_token`, refreshToken);
    localStorage.setItem(`${keyPrefix}_token_expiry`, (Date.now() + (expiresIn * 1000)).toString());
  }

  /**
   * Listens to admin state changes and loads tokens when session is restored.
   * Automatically loads stored tokens when admin session becomes active.
   */
  private listenToAdminStateChanges(): void {
    // Listen for when admin session becomes active and load tokens for that collection
    this.store.select(adminAuthSelectors.selectAdminSessionActive).subscribe(sessionActive => {
      if (sessionActive) {
        this.store.select(adminAuthSelectors.selectSelectedCollectionSlug).pipe(
          filter((collectionSlug: string | null): collectionSlug is string => !!collectionSlug)
        ).subscribe(collectionSlug => {
          this.loadTokensForCollection(collectionSlug);
        });
      }
    });
  }

  /**
   * Loads tokens for a specific collection into memory.
   * Validates token expiry before loading.
   *
   * @param collectionSlug - Collection identifier for which to load tokens
   */
  private loadTokensForCollection(collectionSlug: string): void {
    const keyPrefix = `admin_${collectionSlug}`;
    const accessToken = localStorage.getItem(`${keyPrefix}_access_token`);
    const refreshToken = localStorage.getItem(`${keyPrefix}_refresh_token`);
    const expiry = localStorage.getItem(`${keyPrefix}_token_expiry`);

    if (accessToken && refreshToken && expiry) {
      const expiryTime = parseInt(expiry);
      if (expiryTime > Date.now()) {
        console.log('🔄 Loading stored tokens into memory for collection:', collectionSlug);
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        console.log('✅ Tokens restored from localStorage');
      } else {
        console.log('⚠️ Stored tokens expired for collection:', collectionSlug);
        this.clearTokensForCollection(collectionSlug);
      }
    }
  }

  /**
   * Refreshes the access token using the refresh token.
   * Updates stored tokens and session state on successful refresh.
   *
   * @returns Promise resolving to boolean indicating success
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${environment.relayUrl}/auth/refresh`, {
          refreshToken: this.refreshToken
        })
      );

      if (response.accessToken) {
        const collectionSlug = await firstValueFrom(this.store.select(adminAuthSelectors.selectSelectedCollectionSlug));
        if (collectionSlug) {
          this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn, collectionSlug);
          this.store.dispatch(adminAuthActions.setAdminSession({
            sessionActive: true,
            sessionExpiry: Date.now() + (response.expiresIn * 1000)
          }));
        }
        return true;
      } else {
        this.clearTokens();
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * Starts a timer to automatically refresh tokens before they expire.
   * Checks every minute and refreshes tokens if they expire in less than 5 minutes.
   */
  private initializeTokenRefreshTimer(): void {
    this.tokenRefreshSubscription = interval(60000) // Check every minute
      .subscribe(async () => {
        const sessionActive = await firstValueFrom(this.store.select(adminAuthSelectors.selectAdminSessionActive));
        const sessionExpiry = await firstValueFrom(this.store.select(adminAuthSelectors.selectAdminSessionExpiry));

        if (sessionActive && sessionExpiry) {
          const timeUntilExpiry = sessionExpiry - Date.now();
          // Refresh if token expires in less than 5 minutes
          if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
            await this.refreshAccessToken();
          }
        }
      });
  }

  /**
   * Makes an authenticated request to admin endpoints.
   * Automatically handles token refresh on 401 responses.
   *
   * @param url - The endpoint URL
   * @param data - Request payload
   * @returns Promise resolving to the response data
   * @throws Error if no access token or request fails
   */
  async makeAdminRequest(url: string, data: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    });

    try {
      return await firstValueFrom(
        this.http.post(url, data, { headers })
      );
    } catch (error: any) {
      // If unauthorized, try to refresh token
      if (error.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          const newHeaders = new HttpHeaders({
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          });
          return await firstValueFrom(
            this.http.post(url, data, { headers: newHeaders })
          );
        }
      }
      throw error;
    }
  }

  /**
   * Logs out the user by clearing tokens and resetting state.
   * Attempts to revoke the refresh token on the server.
   */
  async logout(): Promise<void> {
    try {
      // Revoke the refresh token on the server
      if (this.refreshToken) {
        await firstValueFrom(
          this.http.post(`${environment.relayUrl}/auth/logout`, {
            refreshToken: this.refreshToken
          })
        );
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Clear local tokens and reset state
    this.clearTokens();
    this.store.dispatch(adminAuthActions.clearAdminSession());
    console.log('✅ Logged out successfully');
  }

  /**
   * Clears stored tokens for the current collection.
   * Removes tokens from both memory and localStorage.
   */
  private clearTokens(): void {
    const collectionSlug = localStorage.getItem('selectedCollectionSlug');
    if (collectionSlug) {
      this.clearTokensForCollection(collectionSlug);
    }

    // Also clear in-memory tokens
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Clears stored tokens for a specific collection.
   *
   * @param collectionSlug - Collection identifier for which to clear tokens
   */
  private clearTokensForCollection(collectionSlug: string): void {
    const keyPrefix = `admin_${collectionSlug}`;
    localStorage.removeItem(`${keyPrefix}_access_token`);
    localStorage.removeItem(`${keyPrefix}_refresh_token`);
    localStorage.removeItem(`${keyPrefix}_token_expiry`);
  }

  /**
   * Clears all admin tokens from localStorage for all collections.
   * Resets the admin state in the store.
   */
  clearAllAdminTokens(): void {
    console.log('🔧 Clearing all admin tokens from localStorage...');

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('admin_') && (
        key.endsWith('_access_token') ||
        key.endsWith('_refresh_token') ||
        key.endsWith('_token_expiry')
      )) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🔧 Removed token:', key);
    });

    this.accessToken = null;
    this.refreshToken = null;
    this.store.dispatch(adminAuthActions.resetAdminState());
    console.log('✅ All admin tokens cleared');
  }

  /**
   * Tests admin access by making a test request to the backend.
   *
   * @throws Error if the test request fails
   */
  async testAdminAccess(): Promise<void> {
    try {
      const result = await this.makeAdminRequest(`${environment.relayUrl}/admin/has-access`, {});
      console.log('✅ Admin access test successful:', result);
    } catch (error) {
      console.error('❌ Admin access test failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup on service destruction.
   * Unsubscribes from the token refresh timer.
   */
  ngOnDestroy() {
    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
    }
  }
}
