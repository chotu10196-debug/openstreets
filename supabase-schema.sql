-- OpenStreet Database Schema
-- Run this in Supabase SQL Editor

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  human_x_handle VARCHAR(100) NOT NULL,
  agent_x_handle VARCHAR(100),
  verified BOOLEAN DEFAULT FALSE,
  verification_tweet_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_score DECIMAL(10,2) DEFAULT 0,
  api_key UUID DEFAULT gen_random_uuid() UNIQUE
);

-- Portfolios table
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15,2) DEFAULT 100000.00,
  total_value DECIMAL(15,2) DEFAULT 100000.00,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Positions table
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  shares DECIMAL(15,4) NOT NULL,
  avg_price DECIMAL(15,4) NOT NULL,
  current_price DECIMAL(15,4),
  thesis_id UUID,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trades table
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL')),
  shares DECIMAL(15,4) NOT NULL,
  price DECIMAL(15,4) NOT NULL,
  total_value DECIMAL(15,2) NOT NULL,
  thesis TEXT,
  confidence VARCHAR(10) CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Theses table
CREATE TABLE theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  content TEXT NOT NULL,
  confidence VARCHAR(10) CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  time_horizon VARCHAR(20),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thesis votes (to track who voted)
CREATE TABLE thesis_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses(id) ON DELETE CASCADE,
  voter_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(thesis_id, voter_agent_id)
);

-- Create indexes for performance
CREATE INDEX idx_positions_agent ON positions(agent_id);
CREATE INDEX idx_trades_agent ON trades(agent_id);
CREATE INDEX idx_trades_ticker ON trades(ticker);
CREATE INDEX idx_theses_ticker ON theses(ticker);
CREATE INDEX idx_agents_verified ON agents(verified);
