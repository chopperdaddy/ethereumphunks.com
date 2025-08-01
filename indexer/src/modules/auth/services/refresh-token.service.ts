import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '@/modules/storage/storage.service';
import { RefreshToken, CreateRefreshTokenRequest } from '../models/refresh-token.model';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly storageSvc: StorageService,
  ) {}

  /**
   * Creates a new refresh token in the database
   * @param request - The refresh token creation request
   * @returns The created refresh token
   */
  async createRefreshToken(request: CreateRefreshTokenRequest): Promise<RefreshToken> {
    const id = uuidv4();

    const refreshToken: Omit<RefreshToken, 'createdAt'> = {
      id,
      walletAddress: request.walletAddress.toLowerCase(),
      tokenHash: request.tokenHash,
      expiresAt: request.expiresAt,
      isRevoked: false,
    };

    const { data, error } = await this.storageSvc.supabase
      .from('refresh_tokens')
      .insert({
        id: refreshToken.id,
        wallet_address: refreshToken.walletAddress,
        token_hash: refreshToken.tokenHash,
        expires_at: refreshToken.expiresAt.toISOString(),
        is_revoked: refreshToken.isRevoked,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create refresh token', error);
      throw new Error('Failed to create refresh token');
    }

    return this.mapDbToModel(data);
  }

  /**
   * Finds a refresh token by its hash
   * @param tokenHash - The hashed refresh token
   * @returns The refresh token if found and valid
   */
  async findValidRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const { data, error } = await this.storageSvc.supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToModel(data);
  }

  /**
   * Revokes a refresh token
   * @param tokenId - The ID of the token to revoke
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    const { error } = await this.storageSvc.supabase
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('id', tokenId);

    if (error) {
      this.logger.error('Failed to revoke refresh token', error);
      throw new Error('Failed to revoke refresh token');
    }
  }

  /**
   * Revokes all refresh tokens for a wallet address
   * @param walletAddress - The wallet address
   */
  async revokeAllUserTokens(walletAddress: string): Promise<void> {
    const { error } = await this.storageSvc.supabase
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('wallet_address', walletAddress.toLowerCase());

    if (error) {
      this.logger.error('Failed to revoke all user tokens', error);
      throw new Error('Failed to revoke all user tokens');
    }
  }

  /**
   * Cleans up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const { error } = await this.storageSvc.supabase
      .from('refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      this.logger.error('Failed to cleanup expired tokens', error);
    } else {
      this.logger.log('Cleaned up expired refresh tokens');
    }
  }

  /**
   * Generates a secure random token
   * @returns A secure random token string
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashes a token for storage
   * @param token - The token to hash
   * @returns The hashed token
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Maps database row to model
   */
  private mapDbToModel(data: any): RefreshToken {
    return {
      id: data.id,
      walletAddress: data.wallet_address,
      tokenHash: data.token_hash,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
      isRevoked: data.is_revoked,
    };
  }
}
