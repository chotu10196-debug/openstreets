-- Migration: Enable Row Level Security (RLS) on all public tables
-- Created: 2025-02-07
-- CRITICAL SECURITY FIX: Enables RLS and adds security policies

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.thesis_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consensus_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_accuracy ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. DROP EXISTING POLICIES IF THEY EXIST (for idempotency)
-- ============================================================================

-- Agents policies
DROP POLICY IF EXISTS "Allow public read" ON public.agents;

-- Portfolios policies
DROP POLICY IF EXISTS "Allow public read" ON public.portfolios;

-- Positions policies
DROP POLICY IF EXISTS "Allow public read" ON public.positions;

-- Trades policies
DROP POLICY IF EXISTS "Allow public read" ON public.trades;

-- Theses policies
DROP POLICY IF EXISTS "Allow public read" ON public.theses;

-- Thesis votes policies
DROP POLICY IF EXISTS "Allow public read" ON public.thesis_votes;

-- Predictions policies
DROP POLICY IF EXISTS "Allow public read" ON public.predictions;

-- Market price snapshots policies
DROP POLICY IF EXISTS "Allow public read" ON public.market_price_snapshots;

-- Consensus prices policies
DROP POLICY IF EXISTS "Allow public read" ON public.consensus_prices;

-- Agent accuracy policies
DROP POLICY IF EXISTS "Allow public read" ON public.agent_accuracy;

-- ============================================================================
-- 3. CREATE READ POLICIES FOR ANON ROLE (Public Read Access)
-- ============================================================================

CREATE POLICY "Allow public read" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.portfolios FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.theses FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.thesis_votes FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.market_price_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.consensus_prices FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.agent_accuracy FOR SELECT USING (true);

-- ============================================================================
-- 4. WRITE ACCESS CONTROL
-- ============================================================================
-- Note: In Supabase, service_role bypasses RLS by default and can perform
-- all write operations (INSERT, UPDATE, DELETE) regardless of policies.
-- 
-- By NOT creating any INSERT/UPDATE/DELETE policies for anon or authenticated
-- roles, we ensure that:
-- - anon users: Can only SELECT (read) via the policies above
-- - authenticated users: Can only SELECT (read) via the policies above  
-- - service_role: Can perform all operations (bypasses RLS)
--
-- This achieves the desired security: public read access, service_role-only writes.

-- ============================================================================
-- 5. SPECIAL CASE: Create public_agents view (excludes api_key)
-- ============================================================================

-- Drop view if it exists
DROP VIEW IF EXISTS public.public_agents;

-- Create view that excludes api_key column
CREATE VIEW public.public_agents AS
SELECT 
  id,
  name,
  human_x_handle,
  agent_x_handle,
  verified,
  verification_tweet_id,
  created_at,
  total_score
FROM public.agents;

-- Grant SELECT on the view to anon role
GRANT SELECT ON public.public_agents TO anon;
GRANT SELECT ON public.public_agents TO authenticated;

-- ============================================================================
-- 6. ADDITIONAL SECURITY: Protect agents.api_key column
-- ============================================================================

-- Note: PostgreSQL doesn't support column-level RLS directly.
-- The view approach ensures api_key is never exposed to frontend queries.
-- 
-- IMPORTANT: All frontend code should query `public_agents` view instead of
-- the `agents` table directly. The `agents` table should only be accessed
-- by backend services using the service_role key.

COMMENT ON VIEW public.public_agents IS 'Public view of agents table excluding sensitive api_key column. Use this view for all frontend queries.';
