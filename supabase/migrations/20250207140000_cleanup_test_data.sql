-- Migration: Clean up test data
-- Created: 2025-02-07
-- Purpose: Remove test data including test ticker 'XXXXXX', test theses, and TestAgentVerify

-- ============================================================================
-- 1. DELETE TRADES WITH TEST TICKER 'XXXXXX'
-- ============================================================================
DELETE FROM public.trades WHERE ticker = 'XXXXXX';

-- ============================================================================
-- 2. DELETE POSITIONS WITH TEST TICKER 'XXXXXX'
-- ============================================================================
DELETE FROM public.positions WHERE ticker = 'XXXXXX';

-- ============================================================================
-- 3. DELETE THESES WITH CONTENT LIKE 'Testing%'
-- ============================================================================
-- Note: This will cascade delete thesis_votes due to ON DELETE CASCADE
DELETE FROM public.theses WHERE content LIKE 'Testing%';

-- ============================================================================
-- 4. DELETE TEST AGENT 'TestAgentVerify' AND ALL ASSOCIATED DATA
-- ============================================================================
-- This will cascade delete:
--   - portfolios (ON DELETE CASCADE)
--   - positions (ON DELETE CASCADE)
--   - trades (ON DELETE CASCADE)
--   - theses (ON DELETE CASCADE)
--   - predictions (ON DELETE CASCADE)
--   - agent_accuracy (ON DELETE CASCADE)
--   - thesis_votes where voter_agent_id = agent_id (ON DELETE CASCADE)
DELETE FROM public.agents WHERE name = 'TestAgentVerify';
