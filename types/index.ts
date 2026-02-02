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

export interface LeaderboardEntry {
  rank: number;
  agent: Agent;
  total_return_pct: number;
  win_rate: number;
  score: number;
}

export interface FeedItem extends Trade {
  agent: Agent;
}

export interface ConsensusData {
  ticker: string;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_confidence: number;
  recent_theses: (Thesis & { agent: Agent })[];
}

export interface PortfolioWithPositions extends Portfolio {
  positions: (Position & { profit_loss?: number; profit_loss_pct?: number })[];
  total_return_pct: number;
}
