import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { Web3Service } from '../../services/web3.service';
import { environment } from '../../../environments/environment';
import { Store } from '@ngrx/store';
import { GlobalState } from '../../models/global-state';
import { selectConnected, selectWalletAddress } from '../../state/app/app-state.selectors';

interface State {
  walletConnecting: boolean;
  walletConnected: boolean;
  checkingAccess: boolean;
  accessChecked: boolean;
  hasAdminAccess: boolean;
  adminCollections: string[];
  messageSigning: boolean;
  messageSigned: boolean;
  messageVerified: boolean;
  errorMessage: string | null;
  sessionActive: boolean;
  sessionExpiry: number | null;
  collectionSlug: string | null;
}

interface LoginData {
  address: string;
  timestamp: number;
  nonce: string;
  collectionSlug: string;
}

// Updated to match backend's direct AuthSession response
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  collectionSlug: string;
}

interface AdminCollectionsResponse {
  success: boolean;
  address?: string;
  collections?: string[];
  hasAdminAccess?: boolean;
  totalCollections?: number;
  error?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  // Convert to signal
  state = signal<State>({
    walletConnecting: false,
    walletConnected: false,
    checkingAccess: false,
    accessChecked: false,
    hasAdminAccess: false,
    adminCollections: [],
    messageSigning: false,
    messageSigned: false,
    messageVerified: false,
    errorMessage: null,
    sessionActive: false,
    sessionExpiry: null,
    collectionSlug: null,
  });

  // Store selectors
  connected$ = this.store.select(selectConnected);
  walletAddress$ = this.store.select(selectWalletAddress);

  // Computed signals for derived values
  isAuthenticated = computed(() => this.state().sessionActive);

  canProceedToAuth = computed(() => {
    const state = this.state();
    return state.walletConnected && state.accessChecked && state.hasAdminAccess;
  });

  isWalletConnected = computed(() => this.state().walletConnected);

  sessionStatus = computed(() => {
    const state = this.state();
    if (state.sessionActive) return 'active';
    if (state.messageSigning) return 'signing';
    if (state.messageSigned) return 'verifying';
    if (state.checkingAccess) return 'checking-access';
    if (state.walletConnecting) return 'connecting-wallet';
    return 'inactive';
  });

  // Additional computed signals for UI convenience
  timeUntilExpiry = computed(() => {
    const expiry = this.state().sessionExpiry;
    if (!expiry) return null;
    return this.getTimeUntilExpiry(expiry);
  });

  formattedExpiry = computed(() => {
    const expiry = this.state().sessionExpiry;
    if (!expiry) return null;
    return this.formatExpiryTime(expiry);
  });

  hasError = computed(() => !!this.state().errorMessage);

  isProcessing = computed(() => {
    const state = this.state();
    return state.walletConnecting || state.checkingAccess || state.messageSigning || state.messageSigned;
  });

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenRefreshSubscription: Subscription | null = null;
  private walletSubscription: Subscription | null = null;

  constructor(
    public web3Svc: Web3Service,
    private http: HttpClient,
    private store: Store<GlobalState>
  ) {
    console.log('🔧 AdminDashboardComponent constructor called');
    console.log('🔧 Web3Service available:', !!this.web3Svc);
  }

  ngOnInit() {
    console.log('🔧 AdminDashboardComponent ngOnInit called');

    try {
      // Subscribe to wallet connection state
      this.walletSubscription = this.connected$.subscribe(connected => {
        console.log('🔧 Wallet connection state changed:', connected);
        const previouslyConnected = this.state().walletConnected;
        this.setState({ walletConnected: connected });

        if (connected && !this.state().accessChecked && !this.state().sessionActive) {
          // Wallet connected, check admin access
          console.log('🔧 Wallet connected, checking admin access...');
          this.checkAdminAccess();
        } else if (!connected && previouslyConnected) {
          // Wallet disconnected, clear all tokens and reset session
          console.log('🔧 Wallet disconnected, clearing all tokens and session...');
          this.clearAllAdminTokens();
          this.setState({
            sessionActive: false,
            messageVerified: false,
            messageSigned: false,
            sessionExpiry: null,
            accessChecked: false,
            hasAdminAccess: false,
            adminCollections: [],
            collectionSlug: null,
            errorMessage: null
          });

          // Stop token refresh timer
          if (this.tokenRefreshSubscription) {
            this.tokenRefreshSubscription.unsubscribe();
            this.tokenRefreshSubscription = null;
          }
        }
      });

      // Try to load any stored tokens first (for page refresh scenarios)
      this.loadStoredTokens();

      // Only initialize access check if no session was restored
      if (!this.state().sessionActive) {
        console.log('🔧 No active session, initializing access check...');
        this.initializeAccessCheck();
      } else {
        console.log('🔧 Session restored from storage, skipping access check');
      }

      this.startTokenRefreshTimer();
      console.log('🔧 AdminDashboardComponent ngOnInit completed successfully');
    } catch (error) {
      console.error('🔧 Error in AdminDashboardComponent ngOnInit:', error);
    }
  }

  ngOnDestroy() {
    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
    }
    if (this.walletSubscription) {
      this.walletSubscription.unsubscribe();
    }
  }

  /**
   * Generates a random nonce for the login message
   * @returns A random hexadecimal string
   */
  generateNonce(): string {
    return Math.random().toString(16).substring(2, 15);
  }

  /**
   * Signs a login message to verify wallet ownership and create collection-specific JWT session
   * Creates typed data for authentication and sends it to the backend
   */
  async signLoginMessage(): Promise<void> {
    try {
      const currentState = this.state();
      if (!currentState.collectionSlug) {
        this.setState({ errorMessage: 'No collection specified' });
        return;
      }

      this.setState({ messageSigning: true, errorMessage: null });

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
        message: `Sign this message to verify you are an admin of the ${currentState.collectionSlug} collection`,
        collectionSlug: currentState.collectionSlug,
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
        this.setState({ errorMessage: 'Failed to sign message' });
        return;
      }

      this.setState({ messageSigned: true });

      // Send to backend for verification and JWT generation
      const authResponse = await this.authenticateWithBackend({
        address,
        timestamp,
        nonce,
        collectionSlug: currentState.collectionSlug
      }, signature);

      // Backend returns AuthSession directly on success, throws error on failure
      this.storeTokens(authResponse.accessToken, authResponse.refreshToken, authResponse.expiresIn, currentState.collectionSlug);
      this.setState({
        messageVerified: true,
        walletConnected: true,
        sessionActive: true,
        sessionExpiry: Date.now() + (authResponse.expiresIn * 1000)
      });
      console.log(`Authentication successful for ${currentState.collectionSlug} collection, JWT session created`);

    } catch (error) {
      console.error('Error signing login message:', error);
      this.setState({ errorMessage: 'Error signing message. Please try again.' });
    } finally {
      this.setState({ messageSigning: false });
    }
  }

  /**
   * Initializes the wallet connection and access checking flow
   */
  async initializeAccessCheck(): Promise<void> {
    try {
      console.log('🔧 initializeAccessCheck called');

      // Check current wallet connection state
      const connected = await firstValueFrom(this.connected$);
      console.log('🔧 Current wallet connection state:', connected);

      if (connected) {
        console.log('🔧 Wallet already connected, checking admin access...');
        // Wallet is already connected, check admin access
        await this.checkAdminAccess();
      } else {
        console.log('🔧 Wallet not connected, setting initial state...');
        // Wallet not connected, set state accordingly
        this.setState({
          walletConnected: false,
          accessChecked: false,
          hasAdminAccess: false
        });
      }

      console.log('🔧 initializeAccessCheck completed successfully');
    } catch (error: any) {
      console.error('🔧 Error during access check initialization:', error);
      this.setState({ errorMessage: 'Failed to initialize access check: ' + error.message });
    }
  }

  /**
   * Connects the user's wallet
   */
  async connectWallet(): Promise<void> {
    try {
      console.log('🔧 connectWallet called');
      console.log('🔧 Web3Service connect method available:', typeof this.web3Svc.connect);

      this.setState({ walletConnecting: true, errorMessage: null });

      await this.web3Svc.connect();
      console.log('🔧 Web3Service connect completed');

      // The wallet state will be updated automatically via the store subscription
      this.setState({ walletConnecting: false });

      console.log('🔧 connectWallet completed successfully');
    } catch (error: any) {
      console.error('🔧 Error connecting wallet:', error);
      this.setState({
        walletConnecting: false,
        errorMessage: 'Failed to connect wallet: ' + error.message + '. Please try again.'
      });
    }
  }

  /**
   * Checks if the connected wallet has admin access to any collections
   */
  async checkAdminAccess(): Promise<void> {
    try {
      this.setState({ checkingAccess: true, errorMessage: null });

      const address = await firstValueFrom(this.walletAddress$);
      if (!address) {
        this.setState({
          checkingAccess: false,
          errorMessage: 'No wallet address found'
        });
        return;
      }

      const response = await firstValueFrom(
        this.http.post<AdminCollectionsResponse>(`${environment.relayUrl}/auth/check-admin-collections`, {
          address
        })
      );

      if (response.success && response.collections) {
        this.setState({
          checkingAccess: false,
          accessChecked: true,
          hasAdminAccess: response.hasAdminAccess || false,
          adminCollections: response.collections,
          // Auto-select collection if only one available or if specified in URL
          collectionSlug: this.getDefaultCollection(response.collections)
        });

        console.log('Admin access check completed:', {
          hasAccess: response.hasAdminAccess,
          collections: response.collections
        });
      } else {
        this.setState({
          checkingAccess: false,
          accessChecked: true,
          hasAdminAccess: false,
          adminCollections: [],
          errorMessage: response.error || 'Failed to check admin access'
        });
      }

    } catch (error) {
      console.error('Error checking admin access:', error);
      this.setState({
        checkingAccess: false,
        accessChecked: true,
        hasAdminAccess: false,
        adminCollections: [],
        errorMessage: 'Failed to check admin access'
      });
    }
  }

  /**
   * Tests admin access by making a test request to the backend
   */
  async testAdminAccess(): Promise<void> {
    try {
      const result = await this.makeAdminRequest(`${environment.relayUrl}/admin/has-access`, {});
      console.log('✅ Admin access test successful:', result);
      // You could show a success message here
    } catch (error) {
      console.error('❌ Admin access test failed:', error);
      // Error handling is already done in makeAdminRequest
    }
  }

  /**
   * Gets the default collection to select based on available collections
   */
  private getDefaultCollection(adminCollections: string[]): string | null {
    // If only one collection available, auto-select it
    if (adminCollections.length === 1) {
      return adminCollections[0];
    }

    // If multiple collections, don't auto-select - let user choose
    return null;
  }

  /**
   * Sends the signed login data to the backend for verification and JWT generation
   * @param loginData - The login data that was signed
   * @param signature - The signature from the wallet
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
   * Stores JWT tokens securely
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
   * Loads stored tokens from localStorage for the current collection
   */
  private loadStoredTokens(): void {
    const currentState = this.state();

    // If we have a collection slug, try to load tokens for that specific collection
    if (currentState.collectionSlug) {
      this.loadTokensForCollection(currentState.collectionSlug);
      return;
    }

    // If no collection slug is set (e.g., on page refresh), check for any stored tokens
    // and load the collection from the stored tokens
    this.loadAnyStoredTokens();
  }

  /**
   * Loads tokens for a specific collection
   */
  private loadTokensForCollection(collectionSlug: string): void {
    const keyPrefix = `admin_${collectionSlug}`;
    const accessToken = localStorage.getItem(`${keyPrefix}_access_token`);
    const refreshToken = localStorage.getItem(`${keyPrefix}_refresh_token`);
    const expiry = localStorage.getItem(`${keyPrefix}_token_expiry`);

    if (accessToken && refreshToken && expiry) {
      const expiryTime = parseInt(expiry);
      if (expiryTime > Date.now()) {
        console.log('🔄 Loading stored session for collection:', collectionSlug);
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.setState({
          sessionActive: true,
          sessionExpiry: expiryTime,
          collectionSlug: collectionSlug,
          walletConnected: true, // Assume wallet is connected if we have valid tokens
          accessChecked: true,
          hasAdminAccess: true
        });
        this.startTokenRefreshTimer();
        console.log('✅ Session restored from localStorage');
      } else {
        console.log('⚠️ Stored tokens expired for collection:', collectionSlug);
        this.clearTokensForCollection(collectionSlug);
      }
    }
  }

  /**
   * Searches localStorage for any stored admin tokens and loads the first valid one found
   */
  private loadAnyStoredTokens(): void {
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
            console.log('🔄 Found valid stored session for collection:', collectionSlug);
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.setState({
              sessionActive: true,
              sessionExpiry: expiryTime,
              collectionSlug: collectionSlug,
              walletConnected: true,
              accessChecked: true,
              hasAdminAccess: true
            });
            this.startTokenRefreshTimer();
            console.log('✅ Session automatically restored from localStorage');
            return; // Stop after finding the first valid session
          } else {
            console.log('⚠️ Expired tokens found for collection:', collectionSlug);
            this.clearTokensForCollection(collectionSlug);
          }
        }
      }
    }
    console.log('ℹ️ No valid stored sessions found');
  }

  /**
   * Clears stored tokens for a specific collection
   */
  private clearTokensForCollection(collectionSlug: string): void {
    const keyPrefix = `admin_${collectionSlug}`;
    localStorage.removeItem(`${keyPrefix}_access_token`);
    localStorage.removeItem(`${keyPrefix}_refresh_token`);
    localStorage.removeItem(`${keyPrefix}_token_expiry`);
  }

  /**
   * Refreshes the access token using the refresh token
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
        const currentState = this.state();
        this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn, currentState.collectionSlug!);
        this.setState({
          sessionActive: true,
          sessionExpiry: Date.now() + (response.expiresIn * 1000)
        });
        return true;
      } else {
        // Refresh failed, clear tokens
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
   * Starts a timer to automatically refresh tokens before they expire
   */
  private startTokenRefreshTimer(): void {
    this.tokenRefreshSubscription = interval(60000) // Check every minute
      .subscribe(() => {
        const currentState = this.state();
        if (currentState.sessionActive && currentState.sessionExpiry) {
          const timeUntilExpiry = currentState.sessionExpiry - Date.now();
          // Refresh if token expires in less than 5 minutes
          if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
            this.refreshAccessToken();
          }
        }
      });
  }

  /**
   * Makes an authenticated request to admin endpoints
   * @param url - The endpoint URL
   * @param data - The request data
   * @returns Promise with the response
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
   * Logs out the user by clearing tokens and resetting state
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
      // Continue with local logout even if server logout fails
    }

    // Clear local tokens and reset state
    this.clearTokens();
    this.setState({
      sessionActive: false,
      messageVerified: false,
      sessionExpiry: null,
      errorMessage: null,
      // Keep wallet connection and access info so user doesn't have to reconnect
      // walletConnected: false,
      // accessChecked: false,
      // hasAdminAccess: false
    });

    // Stop token refresh timer
    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
      this.tokenRefreshSubscription = null;
    }

    console.log('✅ Logged out successfully');
  }

  /**
   * Clears all stored tokens for the current collection
   */
  private clearTokens(): void {
    const currentState = this.state();
    if (currentState.collectionSlug) {
      this.clearTokensForCollection(currentState.collectionSlug);
    }

    // Also clear in-memory tokens
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Clears all admin tokens from localStorage (for all collections)
   */
  private clearAllAdminTokens(): void {
    console.log('🔧 Clearing all admin tokens from localStorage...');

    // Get all localStorage keys and remove any admin tokens
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

    // Remove all admin-related keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🔧 Removed token:', key);
    });

    // Clear in-memory tokens
    this.accessToken = null;
    this.refreshToken = null;

    console.log('✅ All admin tokens cleared');
  }

  /**
   * Formats a timestamp to a readable time string
   * @param timestamp - The timestamp to format
   * @returns Formatted date string
   */
  formatExpiryTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Gets a human-readable time until expiry
   * @param expiryTimestamp - The expiry timestamp
   * @returns Human-readable time remaining
   */
  getTimeUntilExpiry(expiryTimestamp: number): string {
    const now = Date.now();
    const timeLeft = expiryTimestamp - now;

    if (timeLeft <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Updates the state signal by merging the provided partial state object
   * with the current state.
   *
   * @param newState - The partial state object containing the properties to update.
   * @returns void
   */
  setState(newState: Partial<State>): void {
    this.state.update(currentState => ({
      ...currentState,
      ...newState
    }));
  }
}
