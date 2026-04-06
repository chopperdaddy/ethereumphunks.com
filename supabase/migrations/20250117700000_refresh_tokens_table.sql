-- Create refresh_tokens table for JWT session management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_wallet_address ON refresh_tokens(wallet_address);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Optional: Add a policy for service role access
-- CREATE POLICY "Service role can manage all refresh tokens" ON refresh_tokens
--   FOR ALL USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for JWT-based admin authentication';
COMMENT ON COLUMN refresh_tokens.wallet_address IS 'Ethereum wallet address (lowercase)';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA256 hash of the refresh token';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When this refresh token expires';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Whether this token has been revoked (logout)';
