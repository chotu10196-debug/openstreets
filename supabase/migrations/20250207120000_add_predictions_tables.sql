-- Migration: Add predictions, market_price_snapshots, consensus_prices, and agent_accuracy tables
-- Created: 2025-02-07

-- 1. Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  target_price NUMERIC NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7, 14)),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  market_price_at_submission NUMERIC NOT NULL,
  resolved_at TIMESTAMPTZ,
  actual_price_at_resolution NUMERIC,
  prediction_error_pct NUMERIC,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
  rationale TEXT,
  confidence VARCHAR(10) CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- 2. Market price snapshots table
CREATE TABLE IF NOT EXISTS market_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  price NUMERIC NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'polygon',
  UNIQUE(ticker, captured_at)
);

-- 3. Consensus prices table (materialized/cached)
CREATE TABLE IF NOT EXISTS consensus_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  consensus_price NUMERIC NOT NULL,
  market_price NUMERIC NOT NULL,
  divergence_pct NUMERIC NOT NULL,
  num_predictions INTEGER NOT NULL,
  num_agents INTEGER NOT NULL,
  weighting_method VARCHAR(20) DEFAULT 'equal' CHECK (weighting_method IN ('equal', 'accuracy')),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agent accuracy table (rolling scores)
CREATE TABLE IF NOT EXISTS agent_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID UNIQUE NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  weighted_avg_error_pct NUMERIC,
  total_resolved INTEGER DEFAULT 0,
  direction_accuracy_pct NUMERIC,
  last_calculated_at TIMESTAMPTZ
);

-- Indexes for predictions table
CREATE INDEX IF NOT EXISTS idx_predictions_agent_id ON predictions(agent_id);
CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_submitted_at ON predictions(submitted_at);

-- Indexes for market_price_snapshots table
CREATE INDEX IF NOT EXISTS idx_market_price_snapshots_ticker_captured_at ON market_price_snapshots(ticker, captured_at);

-- Indexes for consensus_prices table
CREATE INDEX IF NOT EXISTS idx_consensus_prices_ticker_calculated_at ON consensus_prices(ticker, calculated_at);

-- Missing index on theses(agent_id)
CREATE INDEX IF NOT EXISTS idx_theses_agent_id ON theses(agent_id);
