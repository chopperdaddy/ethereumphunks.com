import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { recoverTypedDataAddress } from 'viem';
import { RefreshTokenService } from './services/refresh-token.service';
import { JWTPayload, SessionTokens, AuthSession } from './models/refresh-token.model';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '@/modules/storage/storage.service';
import { AppConfigService } from '@/config/config.service';

interface LoginData {
  address: string;
  timestamp: number;
  nonce: string;
  collectionSlug: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly suffix: string;

  constructor(
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
    private storageService: StorageService,
    private configService: AppConfigService,
  ) {
    // Use same suffix pattern as StorageService for consistency
    this.suffix = this.configService.chain.chainIdL1 === 1 ? '' : '_sepolia';
    console.log('🔗 AuthService initialized with suffix:', this.suffix);
  }

  /**
   * Verifies wallet login signature and collection admin access
   */
  async verifyWalletLogin(loginData: LoginData, signature: string): Promise<AuthSession> {
    console.log('🔐 Collection-specific wallet login attempt:', {
      address: loginData.address,
      collectionSlug: loginData.collectionSlug,
      timestamp: loginData.timestamp,
      nonce: loginData.nonce,
      currentTime: Math.floor(Date.now() / 1000)
    });

    // Validate timestamp (5 minutes tolerance)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - loginData.timestamp);

    console.log('⏰ Timestamp validation:', {
      currentTime,
      messageTime: loginData.timestamp,
      difference: timeDifference,
      maxAllowed: 300,
      valid: timeDifference <= 300
    });

    if (timeDifference > 300) { // 5 minutes
      console.log('❌ Timestamp validation failed: Message too old or too far in future');
      throw new Error('Message timestamp is invalid');
    }

    // Get chain ID from configuration
    const chainId = BigInt(this.configService.chain.chainIdL1);
    console.log('🔗 Using chain ID from config:', chainId);

    // Verify the signature using EIP-712
    const domain = {
      name: 'EtherPhunks Admin',
      version: '1',
      chainId: chainId,
    };

    const types = {
      Login: [
        { name: 'message', type: 'string' },
        { name: 'collectionSlug', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'nonce', type: 'string' },
      ],
    };

    const message = {
      message: `Sign this message to verify you are an admin of the ${loginData.collectionSlug} collection`,
      collectionSlug: loginData.collectionSlug,
      timestamp: BigInt(loginData.timestamp),
      nonce: loginData.nonce,
    };

    console.log('🔍 Verifying signature with domain:', domain);
    console.log('🔍 Message structure:', message);

    try {
      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types,
        primaryType: 'Login',
        message,
        signature: signature as `0x${string}`,
      });

      console.log('✅ Signature verification:', {
        claimed: loginData.address,
        recovered: recoveredAddress,
        match: recoveredAddress.toLowerCase() === loginData.address.toLowerCase()
      });

      if (recoveredAddress.toLowerCase() !== loginData.address.toLowerCase()) {
        console.log('❌ Signature verification failed: Address mismatch');
        throw new Error('Invalid signature');
      }

      // Check collection-specific admin access
      const hasAdminAccess = await this.checkCollectionAdminAccess(
        loginData.address,
        loginData.collectionSlug
      );

      if (!hasAdminAccess) {
        console.log('❌ Collection admin access denied');
        throw new Error('Not authorized as admin for this collection');
      }

      console.log('✅ Collection admin access verified');

      // Generate session tokens
      const session = await this.generateAdminSession(loginData.address, loginData.collectionSlug);

      console.log('✅ Collection-specific wallet login successful!');
      return session;

    } catch (error) {
      console.error('❌ Signature verification error:', error);
      throw new Error('Signature verification failed');
    }
  }

  /**
   * Checks if an address is an admin for a specific collection
   * Uses the same suffix pattern as StorageService for chain-specific tables
   */
  private async checkCollectionAdminAccess(address: string, collectionSlug: string): Promise<boolean> {
    console.log('🔍 Checking collection admin access:', {
      address: address.toLowerCase(),
      collectionSlug,
      tableName: `collections${this.suffix}`
    });

    try {
      const { data: collection, error } = await this.storageService.supabase
        .from(`collections${this.suffix}`)
        .select('"adminAddress"')
        .eq('slug', collectionSlug)
        .eq('"adminAddress"', address.toLowerCase())
        .single();

      if (collection) {
        console.log(`✅ Admin access confirmed from collections${this.suffix} table`);
        return true;
      }

      console.log('❌ Admin access denied:', {
        error: error?.message,
        address: address.toLowerCase(),
        collectionSlug,
        table: `collections${this.suffix}`
      });

      return false;
    } catch (error) {
      console.error('❌ Error checking collection admin access:', error);
      return false;
    }
  }

  /**
   * Gets all collections that an address can admin
   * Uses chain-specific table based on suffix
   */
  async getAdminCollections(address: string): Promise<{ collections: string[], hasAdminAccess: boolean }> {
    console.log('🔍 Checking admin collections for address:', address);

    try {
      const { data: collections, error } = await this.storageService.supabase
        .from(`collections${this.suffix}`)
        .select('slug')
        .eq('"adminAddress"', address.toLowerCase());

      if (error) {
        console.error('❌ Error fetching admin collections:', error);
        return { collections: [], hasAdminAccess: false };
      }

      const collectionSlugs = collections?.map(c => c.slug) || [];
      const hasAdminAccess = collectionSlugs.length > 0;

      console.log(`✅ Found ${this.suffix ? 'sepolia' : 'mainnet'} admin collections:`, collectionSlugs);
      console.log('🎯 Total admin collections for address:', {
        address,
        collections: collectionSlugs,
        totalCount: collectionSlugs.length
      });

      return {
        collections: collectionSlugs,
        hasAdminAccess
      };
    } catch (error) {
      console.error('❌ Error getting admin collections:', error);
      return { collections: [], hasAdminAccess: false };
    }
  }

  /**
   * Generates JWT session tokens for an authenticated admin
   */
  private async generateAdminSession(walletAddress: string, collectionSlug: string): Promise<AuthSession> {
    const jwtId = uuidv4();

    const payload: Omit<JWTPayload, 'exp' | 'iat'> = {
      sub: walletAddress.toLowerCase(),
      admin: true,
      wallet_verified: true,
      collection_slug: collectionSlug,
      jti: jwtId,
    };

    // Generate access token (30 minutes)
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (7 days)
    const refreshTokenValue = await this.refreshTokenService.generateSecureToken();
    const refreshTokenHash = await this.refreshTokenService.hashToken(refreshTokenValue);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshTokenService.createRefreshToken({
      walletAddress: walletAddress.toLowerCase(),
      tokenHash: refreshTokenHash,
      expiresAt
    });

    console.log('🎟️ Session tokens generated successfully');

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 30 * 60, // 30 minutes in seconds
      collectionSlug
    };
  }

  /**
   * Refreshes an access token using a valid refresh token
   */
  async refreshSession(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; collectionSlug: string }> {
    console.log('🔄 Token refresh request');

    try {
      const refreshTokenHash = await this.refreshTokenService.hashToken(refreshToken);
      const tokenData = await this.refreshTokenService.findValidRefreshToken(refreshTokenHash);

      if (!tokenData) {
        console.log('❌ Invalid or expired refresh token');
        throw new Error('Invalid refresh token');
      }

      // For now, we'll get the collection slug from admin collections since it's not stored with refresh token
      // This is a design limitation we may want to address later by adding collectionSlug to RefreshToken
      const adminCollections = await this.getAdminCollections(tokenData.walletAddress);
      const collectionSlug = adminCollections.collections[0] || 'ethereum-phunks'; // Default to first collection

      // Generate new access token
      const payload: Omit<JWTPayload, 'exp' | 'iat'> = {
        sub: tokenData.walletAddress,
        admin: true,
        wallet_verified: true,
        collection_slug: collectionSlug,
        jti: uuidv4(),
      };

      const accessToken = this.jwtService.sign(payload);

      console.log('✅ Access token refreshed successfully');

      return {
        accessToken,
        expiresIn: 30 * 60, // 30 minutes
        collectionSlug: collectionSlug
      };

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Revokes a refresh token (logout)
   */
  async revokeSession(refreshToken: string): Promise<void> {
    console.log('�� Logout request');

    try {
      const refreshTokenHash = await this.refreshTokenService.hashToken(refreshToken);
      const tokenData = await this.refreshTokenService.findValidRefreshToken(refreshTokenHash);

      if (tokenData) {
        await this.refreshTokenService.revokeRefreshToken(tokenData.id);
        console.log('✅ Session revoked successfully');
      } else {
        console.log('⚠️ Refresh token not found or already expired');
      }

    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw new Error('Failed to logout');
    }
  }

  /**
   * Validates a JWT token and returns the payload
   */
  async validateJWT(token: string): Promise<JWTPayload | null> {
    try {
      const payload = this.jwtService.verify<JWTPayload>(token);
      console.log('✅ JWT validation successful:', {
        sub: payload.sub,
        admin: payload.admin,
        collection_slug: payload.collection_slug,
        jti: payload.jti
      });
      return payload;
    } catch (error) {
      console.log('❌ JWT validation failed:', error.message);
      return null;
    }
  }

  /**
   * Revokes all refresh tokens for a user (logout from all devices)
   */
  async revokeAllSessions(address: string): Promise<void> {
    console.log(`🔐 Revoking all sessions for: ${address}`);
    await this.refreshTokenService.revokeAllUserTokens(address.toLowerCase());
    console.log('✅ All sessions revoked successfully');
  }
}
