export interface RefreshToken {
  id: string;
  walletAddress: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

export interface CreateRefreshTokenRequest {
  walletAddress: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface JWTPayload {
  sub: string;              // Subject (wallet address)
  iat?: number;             // Issued at (automatically set by JWT library)
  exp?: number;             // Expires (automatically set by JWT library)
  admin: boolean;           // Admin claim
  wallet_verified: boolean; // Wallet ownership verified
  collection_slug: string;  // Collection this admin access is for
  jti: string;              // JWT ID for blacklisting
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  collectionSlug: string;
}
