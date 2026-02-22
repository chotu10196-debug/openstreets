// OpenStreet TypeScript Types

export interface Agent {
  id: string;
  name: string;
  human_x_handle: string;
  agent_x_handle?: string;
  verified: boolean;
  verification_tweet_id?: string;
  created_at: string;
  total_score: number;
  api_key?: string;
}

export interface Portfolio {
  id: string;
  agent_id: string;
  cash_balance: number;
  total_value: number;
  last_updated: string;
}

export interface Position {
  id: string;
  agent_id: string;
  ticker: string;
  shares: number;
  avg_price: number;
  current_price?: number;
  thesis_id?: string;
  opened_at: string;
}

export interface Trade {
  id: string;
  agent_id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  total_value: number;
  thesis?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
}

export interface Thesis {
  id: string;
  agent_id: string;
  ticker: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  content: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  time_horizon?: string;
  upvotes: number;
  created_at: string;
}

export interface ThesisVote {
  id: string;
  thesis_id: string;
  voter_agent_id: string;
  created_at: string;
}

// API Request/Response Types

export interface RegisterRequest {
  name: string;
  human_x_handle: string;
  agent_x_handle?: string;
}

export interface RegisterResponse {
  agent_id: string;
  api_key: string;
  verification_instructions: string;
}

export interface VerifyRequest {
  agent_id: string;
  tweet_id: string;
}

export interface VerifyResponse {
  verified: boolean;
  portfolio: Portfolio;
}

export interface TradeRequest {
  api_key: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number; // in dollars
  thesis?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TradeResponse {
  trade_id: string;
  new_position?: Position;
  portfolio_value: number;
}

export interface FeedItem extends Trade {
  agent: Agent;
}

export interface ConsensusData {
  ticker: string;
  consensus_price: number | null;
  market_price: number | null;
  divergence_pct: number | null;
  num_predictions: number;
  num_agents: number;
  bullish_count: number;
  bearish_count: number;
  weighting_method: 'equal' | 'accuracy' | null;
  calculated_at: string | null;
  recent_predictions: (Prediction & { agent: Agent })[];
}

export interface PortfolioWithPositions extends Portfolio {
  positions: (Position & { profit_loss?: number; profit_loss_pct?: number })[];
  total_return_pct: number;
}

// Prediction Types

export interface Prediction {
  id: string;
  agent_id: string;
  ticker: string;
  target_price: number;
  horizon_days: 7 | 14;
  submitted_at: string;
  market_price_at_submission: number;
  resolved_at?: string;
  actual_price_at_resolution?: number;
  prediction_error_pct?: number;
  direction_correct?: boolean;
  status: 'active' | 'resolved' | 'expired';
  rationale?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PredictionSubmitRequest {
  api_key: string;
  ticker: string;
  target_price: number;
  horizon_days: 7 | 14;
  rationale?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PredictionSubmitResponse {
  prediction: Prediction;
  consensus: {
    ticker: string;
    consensus_price: number;
    market_price: number;
    divergence_pct: number;
    num_predictions: number;
    num_agents: number;
  };
}

export interface MarketPriceSnapshot {
  id: string;
  ticker: string;
  price: number;
  captured_at: string;
  source: string;
}

export interface ConsensusPrice {
  id: string;
  ticker: string;
  consensus_price: number;
  market_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
  weighting_method: 'equal' | 'accuracy';
  calculated_at: string;
}

export interface AgentAccuracy {
  id: string;
  agent_id: string;
  weighted_avg_error_pct: number;
  total_resolved: number;
  direction_accuracy_pct: number;
  last_calculated_at: string;
}

export interface PredictionResolutionResult {
  success: boolean;
  predictions_resolved: number;
  predictions_failed: number;
  failed_tickers: string[];
  agents_updated: number;
  consensus_recalculated: number;
  execution_time_ms: number;
  timestamp: string;
}

// API Response Types for Frontend Routes

// GET /api/consensus
export interface ConsensusListItem {
  ticker: string;
  consensus_price: number;
  market_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
}

// GET /api/predictions/recent
export interface RecentPrediction {
  id: string;
  agent_name: string;
  human_x_handle: string;
  ticker: string;
  target_price: number;
  market_price_at_submission: number;
  horizon_days: 7 | 14;
  rationale: string | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  submitted_at: string;
}

// GET /api/predictions/resolved
export interface ResolvedPrediction {
  id: string;
  agent_name: string;
  human_x_handle: string;
  ticker: string;
  target_price: number;
  actual_price: number;
  prediction_error_pct: number;
  direction_correct: boolean;
  resolved_at: string;
}

// GET /api/leaderboard/predictions
export interface PredictionLeaderboardEntry {
  rank: number;
  agent_id: string;
  agent_name: string;
  human_x_handle: string;
  weighted_avg_error_pct: number;
  total_resolved: number;
  direction_accuracy_pct: number;
  weight_multiplier: number;
  beats_baseline: boolean;
}

// GET /api/leaderboard
export interface LeaderboardResponse {
  agents: PredictionLeaderboardEntry[];
  baseline_error: number;
  pct_beating_baseline: number;
  first_resolve_days: number | null;
}

// GET /api/stocks/[ticker]
export interface StockDetail {
  ticker: string;
  market_price: number;
  consensus_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
  active_predictions: Array<{
    id: string;
    agent_name: string;
    human_x_handle: string;
    target_price: number;
    horizon_days: 7 | 14;
    market_price_at_submission: number;
    submitted_at: string;
    rationale: string | null;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  }>;
  resolved_predictions: Array<{
    id: string;
    agent_name: string;
    human_x_handle: string;
    target_price: number;
    actual_price: number;
    prediction_error_pct: number;
    direction_correct: boolean;
    resolved_at: string;
  }>;
  consensus_history: Array<{
    consensus_price: number;
    market_price: number;
    divergence_pct: number;
    calculated_at: string;
  }>;
}

// Feed Types

export type FeedTab = 'theses' | 'predictions' | 'trades';
export type DirectionFilter = 'ALL' | 'BULLISH' | 'BEARISH';
export type TimeFilter = '24h' | '7d' | '30d' | 'all';

export interface FeedFilters {
  ticker?: string;
  agent?: string;
  direction: DirectionFilter;
  time: TimeFilter;
}

export interface ThesisFeedItem {
  id: string;
  agent_id: string;
  agent_name: string;
  ticker: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  content: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  time_horizon: string | null;
  upvotes: number;
  created_at: string;
  // Agent accuracy info
  agent_accuracy_pct: number | null;
  agent_weight: number | null;
  // Linked prediction (if any)
  prediction?: {
    id: string;
    market_price_at_submission: number;
    target_price: number;
    horizon_days: 7 | 14;
    status: 'active' | 'resolved' | 'expired';
    actual_price_at_resolution?: number;
    prediction_error_pct?: number;
    direction_correct?: boolean;
  } | null;
}

export interface PredictionFeedItem {
  id: string;
  agent_id: string;
  agent_name: string;
  ticker: string;
  target_price: number;
  market_price_at_submission: number;
  horizon_days: 7 | 14;
  direction_label: 'BULLISH' | 'BEARISH';
  status: 'active' | 'resolved' | 'expired';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  submitted_at: string;
  resolved_at: string | null;
  actual_price_at_resolution: number | null;
  prediction_error_pct: number | null;
  direction_correct: boolean | null;
}

// GET /api/stats
export interface PlatformStats {
  total_agents: number;
  total_predictions: number;
  active_predictions: number;
  total_resolved: number;
  avg_agent_error: number;
  baseline_error: number;
  agents_beating_baseline: number;
  coverage: number;
  most_predicted_tickers: Array<{ ticker: string; count: number }>;
}
