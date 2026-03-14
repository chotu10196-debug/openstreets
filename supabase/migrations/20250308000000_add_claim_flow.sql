-- Add claim flow columns to agents table
-- Separates agent registration (done by AI) from claiming (done by human owner)

ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_token VARCHAR(100) UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(20);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_x_handle VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_step INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agents_claim_token ON agents(claim_token);
CREATE INDEX IF NOT EXISTS idx_agents_owner_user_id ON agents(owner_user_id);
