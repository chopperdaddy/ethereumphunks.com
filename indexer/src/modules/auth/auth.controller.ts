import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JWTPayload, AuthSession } from './models/refresh-token.model';

interface LoginData {
  address: string;
  timestamp: number;
  nonce: string;
  collectionSlug: string;
}

interface AdminCollectionsRequest {
  address: string;
}

interface AdminCollectionsResponse {
  success: boolean;
  collections?: string[];
  hasAdminAccess?: boolean;
  error?: string;
}

interface VerifyRequest {
  loginData: LoginData;
  signature: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  /**
   * Verifies wallet signature and returns JWT session tokens
   */
  @Post('verify-wallet')
  async verifyWallet(@Body() { loginData, signature }: VerifyRequest): Promise<AuthSession> {
    console.log('🔐 Collection admin verification request:', {
      address: loginData.address,
      collectionSlug: loginData.collectionSlug,
      timestamp: loginData.timestamp
    });

    try {
      const authSession = await this.authService.verifyWalletLogin(loginData, signature);
      console.log('✅ Collection-specific wallet verification successful');
      return authSession;
    } catch (error) {
      console.error('❌ Wallet verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Check which collections an address can admin
   */
  @Post('check-admin-collections')
  async checkAdminCollections(@Body() { address }: AdminCollectionsRequest): Promise<AdminCollectionsResponse> {
    console.log('🔍 Admin collections check request:', { address });

    try {
      const result = await this.authService.getAdminCollections(address);

      return {
        success: true,
        collections: result.collections,
        hasAdminAccess: result.hasAdminAccess
      };
    } catch (error) {
      console.error('❌ Error checking admin collections:', error);
      return {
        success: false,
        error: 'Failed to check admin collections'
      };
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  @Post('refresh')
  async refresh(@Body() { refreshToken }: RefreshRequest): Promise<{ accessToken: string; expiresIn: number; }> {
    try {
      const session = await this.authService.refreshSession(refreshToken);
      return {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logs out user by revoking refresh token
   */
  @Post('logout')
  async logout(@Body() { refreshToken }: LogoutRequest): Promise<{ success: boolean }> {
    try {
      await this.authService.revokeSession(refreshToken);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}
