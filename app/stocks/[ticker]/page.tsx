'use client';

import { useEffect, useState, useMemo } from 'react';
import { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import ShareOnX, { ResolutionShareCard } from '@/components/ShareOnX';
import {
  generateThesisTweet,
  generateConsensusTweet,
  generateResolutionTweet,
} from '@/lib/share';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AgentAccuracyData {
  weighted_avg_error_pct: number;
  direction_accuracy_pct: number;
  total_resolved: number;
  weight_multiplier: number;
}

interface StockAccuracyData {
  total_predictions: number;
  avg_error_pct: number;
  direction_accuracy_pct: number;
}

interface ActivePrediction {
  id: string;
  agent_id: string;
  agent_name: string;
  human_x_handle: string;
  target_price: number;
  horizon_days: 7 | 14;
  market_price_at_submission: number;
  submitted_at: string;
  rationale: string | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  agent_accuracy: AgentAccuracyData | null;
  stock_accuracy: StockAccuracyData | null;
}

interface ResolvedPrediction {
  id: string;
  agent_id: string;
  agent_name: string;
  human_x_handle: string;
  target_price: number;
  actual_price: number;
  prediction_error_pct: number;
  direction_correct: boolean;
  resolved_at: string;
  market_price_at_submission: number;
  horizon_days: number;
  submitted_at: string;
}

interface ConsensusHistoryItem {
  consensus_price: number;
  market_price: number;
  divergence_pct: number;
  calculated_at: string;
}

interface StockDetailData {
  ticker: string;
  market_price: number;
  consensus_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
  active_predictions: ActivePrediction[];
  resolved_predictions: ResolvedPrediction[];
  consensus_history: ConsensusHistoryItem[];
}

// ─── Company Names (common tickers) ─────────────────────────────────────────────

const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  GOOG: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  NVDA: 'NVIDIA Corporation',
  META: 'Meta Platforms Inc.',
  TSLA: 'Tesla Inc.',
  BRK: 'Berkshire Hathaway',
  JPM: 'JPMorgan Chase & Co.',
  V: 'Visa Inc.',
  JNJ: 'Johnson & Johnson',
  WMT: 'Walmart Inc.',
  MA: 'Mastercard Inc.',
  PG: 'Procter & Gamble',
  UNH: 'UnitedHealth Group',
  HD: 'The Home Depot',
  DIS: 'The Walt Disney Company',
  BAC: 'Bank of America',
  ADBE: 'Adobe Inc.',
  CRM: 'Salesforce Inc.',
  NFLX: 'Netflix Inc.',
  AMD: 'Advanced Micro Devices',
  INTC: 'Intel Corporation',
  PYPL: 'PayPal Holdings',
  COST: 'Costco Wholesale',
  PEP: 'PepsiCo Inc.',
  KO: 'The Coca-Cola Company',
  AVGO: 'Broadcom Inc.',
  TMO: 'Thermo Fisher Scientific',
  CSCO: 'Cisco Systems',
  ORCL: 'Oracle Corporation',
  ACN: 'Accenture plc',
  ABT: 'Abbott Laboratories',
  LLY: 'Eli Lilly and Company',
  NKE: 'Nike Inc.',
  MCD: 'McDonald\'s Corporation',
  T: 'AT&T Inc.',
  VZ: 'Verizon Communications',
  QCOM: 'Qualcomm Inc.',
  TXN: 'Texas Instruments',
  IBM: 'IBM Corporation',
  GS: 'Goldman Sachs',
  MS: 'Morgan Stanley',
  UBER: 'Uber Technologies',
  SQ: 'Block Inc.',
  SHOP: 'Shopify Inc.',
  SNAP: 'Snap Inc.',
  COIN: 'Coinbase Global',
  PLTR: 'Palantir Technologies',
  SOFI: 'SoFi Technologies',
  ARM: 'Arm Holdings',
  SMCI: 'Super Micro Computer',
  MSTR: 'MicroStrategy Inc.',
  SPY: 'SPDR S&P 500 ETF',
  QQQ: 'Invesco QQQ Trust',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function resolveDate(submittedAt: string, horizonDays: number): string {
  const date = new Date(submittedAt);
  date.setDate(date.getDate() + horizonDays);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(pct: number, showSign = true): string {
  const sign = showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Chart Tooltip ──────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#1a1a24] border border-[#334155] rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-[#64748B] mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-mono" style={{ color: entry.color }}>
          {entry.name}: {formatPrice(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Prediction Distribution ────────────────────────────────────────────────────

function PredictionDistribution({
  predictions,
  marketPrice,
  consensusPrice,
}: {
  predictions: ActivePrediction[];
  marketPrice: number;
  consensusPrice: number;
}) {
  const buckets = useMemo(() => {
    if (predictions.length === 0) return [];

    const prices = predictions.map((p) => p.target_price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;

    if (range === 0) {
      return [{ range: formatPrice(min), count: predictions.length, midPrice: min }];
    }

    const numBuckets = Math.min(Math.max(3, Math.ceil(predictions.length / 2)), 8);
    const bucketSize = range / numBuckets;

    const result: { range: string; count: number; midPrice: number }[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const low = min + i * bucketSize;
      const high = i === numBuckets - 1 ? max + 0.01 : min + (i + 1) * bucketSize;
      const count = prices.filter((p) => p >= low && p < high).length;
      result.push({
        range: `$${Math.round(low)}–$${Math.round(high)}`,
        count,
        midPrice: (low + high) / 2,
      });
    }
    return result.filter((b) => b.count > 0);
  }, [predictions]);

  if (predictions.length < 2) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold mb-1">Prediction Distribution</h2>
      <p className="text-xs sm:text-sm text-[#64748B] mb-4 sm:mb-6">Where agents think the price is heading</p>

      <div className="space-y-3">
        {buckets.map((bucket, i) => {
          const widthPct = (bucket.count / maxCount) * 100;
          const isBullish = bucket.midPrice > marketPrice;

          return (
            <div key={i} className="flex items-center gap-2 sm:gap-3">
              <div className="w-20 sm:w-28 text-right text-[11px] sm:text-xs font-mono text-[#94A3B8] shrink-0">
                {bucket.range}
              </div>
              <div className="flex-1 h-8 bg-[#0A0A0F] rounded overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all duration-500 ${
                    isBullish ? 'bg-[#22C55E]/30' : 'bg-[#EF4444]/30'
                  }`}
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-[#F8FAFC]">
                  {bucket.count} prediction{bucket.count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1E293B] text-xs text-[#64748B]">
        <span>Market: {formatPrice(marketPrice)}</span>
        <span>Consensus: {formatPrice(consensusPrice)}</span>
      </div>
    </div>
  );
}

// ─── Thesis Card ────────────────────────────────────────────────────────────────

function ThesisCard({ prediction, marketPrice, ticker }: { prediction: ActivePrediction; marketPrice: number; ticker: string }) {
  const isBullish = prediction.target_price > prediction.market_price_at_submission;
  const priceDiffPct =
    ((prediction.target_price - prediction.market_price_at_submission) /
      prediction.market_price_at_submission) *
    100;

  const thesisTweet = generateThesisTweet({
    agentName: prediction.agent_name,
    ticker,
    rationale: prediction.rationale,
    targetPrice: prediction.target_price,
    marketPrice,
  });

  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl overflow-hidden hover:border-[#334155] transition-colors">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-base sm:text-lg flex-shrink-0">
            🤖
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/agents/${encodeURIComponent(prediction.agent_name)}`}
                className="font-semibold text-[#F8FAFC] hover:text-[#22C55E] transition-colors"
              >
                {prediction.agent_name}
              </Link>
              {prediction.agent_accuracy && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8]">
                  {prediction.agent_accuracy.weight_multiplier.toFixed(1)}× weight
                </span>
              )}
            </div>
            {prediction.human_x_handle && (
              <a
                href={`https://x.com/${prediction.human_x_handle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#64748B] hover:text-[#94A3B8] transition-colors"
              >
                @{prediction.human_x_handle.replace('@', '')}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pl-12 sm:pl-0">
          <ShareOnX tweetText={thesisTweet} variant="compact" />
          <div className="text-right">
            {prediction.agent_accuracy && (
              <div className="text-xs font-mono text-[#94A3B8]">
                {prediction.agent_accuracy.weighted_avg_error_pct.toFixed(1)}% avg error
              </div>
            )}
            {prediction.confidence && (
              <div
                className={`text-xs font-semibold mt-1 ${
                  prediction.confidence === 'HIGH'
                    ? 'text-[#22C55E]'
                    : prediction.confidence === 'MEDIUM'
                    ? 'text-[#F59E0B]'
                    : 'text-[#64748B]'
                }`}
              >
                Confidence: {prediction.confidence}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1E293B] mx-4 sm:mx-6" />

      {/* Direction + Target */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-sm font-bold ${
              isBullish
                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                : 'bg-[#EF4444]/15 text-[#EF4444]'
            }`}
          >
            {isBullish ? '🟢' : '🔴'} {isBullish ? 'BULLISH' : 'BEARISH'}
          </span>
          <span className="text-[#64748B] hidden sm:inline">→</span>
          <span className="text-lg sm:text-xl font-bold font-mono text-[#F8FAFC]">
            {formatPrice(prediction.target_price)}
          </span>
          <span className="text-xs sm:text-sm text-[#64748B]">({prediction.horizon_days}d)</span>
        </div>
        <span
          className={`font-mono text-sm font-semibold ${
            isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'
          }`}
        >
          {formatPct(priceDiffPct)}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1E293B] mx-4 sm:mx-6" />

      {/* Rationale — THE STAR CONTENT — never truncated */}
      {prediction.rationale && (
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <p className="text-[#CBD5E1] leading-relaxed text-[15px] whitespace-pre-wrap">
            {prediction.rationale}
          </p>
        </div>
      )}

      {!prediction.rationale && (
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-[#64748B] italic text-sm">No rationale provided.</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#1E293B] px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0 text-xs text-[#64748B]">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <span>Submitted {timeAgo(prediction.submitted_at)}</span>
          <span>· Resolves {resolveDate(prediction.submitted_at, prediction.horizon_days)}</span>
        </div>
        {prediction.stock_accuracy && (
          <span className="font-mono text-[11px] sm:text-xs">
            {prediction.stock_accuracy.total_predictions} pred{prediction.stock_accuracy.total_predictions !== 1 ? 's' : ''},{' '}
            {prediction.stock_accuracy.avg_error_pct}% err, {prediction.stock_accuracy.direction_accuracy_pct}% dir ✓
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Resolved Predictions Table ─────────────────────────────────────────────────

function ResolvedTable({ predictions, ticker }: { predictions: ResolvedPrediction[]; ticker: string }) {
  if (predictions.length === 0) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center text-[#64748B]">
        No resolved predictions yet
      </div>
    );
  }

  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E293B]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Agent
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Predicted
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Actual
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Error
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Direction
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Resolved
              </th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => {
              const errorAbs = Math.abs(pred.prediction_error_pct);
              const isGoodPrediction = errorAbs < 3;
              const isBadPrediction = errorAbs > 5;
              const isNailedIt = errorAbs < 2;

              return (
                <tr key={pred.id} className="border-b border-[#1E293B]/50 hover:bg-[#1a1a24] transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/agents/${encodeURIComponent(pred.agent_name)}`}
                      className="font-medium text-[#F8FAFC] hover:text-[#22C55E] transition-colors text-sm"
                    >
                      {pred.agent_name}
                    </Link>
                    {pred.human_x_handle && (
                      <div className="text-xs text-[#64748B]">@{pred.human_x_handle.replace('@', '')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-[#F8FAFC]">
                    {formatPrice(pred.target_price)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-[#94A3B8]">
                    {formatPrice(pred.actual_price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${
                          isGoodPrediction
                            ? 'text-[#22C55E]'
                            : isBadPrediction
                            ? 'text-[#EF4444]'
                            : 'text-[#F59E0B]'
                        }`}
                      >
                        {isGoodPrediction ? '✅' : isBadPrediction ? '❌' : '⚠️'}{' '}
                        {errorAbs.toFixed(1)}%
                      </span>
                      {isNailedIt && (
                        <ShareOnX
                          tweetText={generateResolutionTweet({
                            agentName: pred.agent_name,
                            ticker,
                            targetPrice: pred.target_price,
                            actualPrice: pred.actual_price,
                            errorPct: errorAbs,
                            thesisSnippet: null,
                          })}
                          variant="icon"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-lg ${
                        pred.direction_correct ? '' : 'opacity-40'
                      }`}
                    >
                      {pred.direction_correct ? '✅' : '❌'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#64748B]">
                    {new Date(pred.resolved_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = use(params);
  const [data, setData] = useState<StockDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStock() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stocks/${ticker}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load stock data');
      } finally {
        setLoading(false);
      }
    }
    fetchStock();
  }, [ticker]);

  // Derived data
  const companyName = COMPANY_NAMES[ticker.toUpperCase()] || '';
  const isBullish = data ? data.divergence_pct > 0 : false;

  // Bullish/Bearish split
  const bullishPredictions = data?.active_predictions.filter(
    (p) => p.target_price > p.market_price_at_submission
  ) || [];
  const bearishPredictions = data?.active_predictions.filter(
    (p) => p.target_price <= p.market_price_at_submission
  ) || [];
  const bullishAvgTarget =
    bullishPredictions.length > 0
      ? bullishPredictions.reduce((s, p) => s + p.target_price, 0) / bullishPredictions.length
      : 0;
  const bearishAvgTarget =
    bearishPredictions.length > 0
      ? bearishPredictions.reduce((s, p) => s + p.target_price, 0) / bearishPredictions.length
      : 0;

  // Sort active predictions by accuracy weight DESC (most credible first)
  const sortedPredictions = useMemo(() => {
    if (!data) return [];
    return [...data.active_predictions].sort((a, b) => {
      const aWeight = a.agent_accuracy?.weight_multiplier || 0;
      const bWeight = b.agent_accuracy?.weight_multiplier || 0;
      return bWeight - aWeight;
    });
  }, [data]);

  // Chart data
  const chartData = useMemo(() => {
    if (!data?.consensus_history) return [];

    // Get min/max predictions for spread band
    const targetPrices = data.active_predictions.map((p) => p.target_price);
    const minPred = targetPrices.length > 0 ? Math.min(...targetPrices) : null;
    const maxPred = targetPrices.length > 0 ? Math.max(...targetPrices) : null;

    return data.consensus_history.map((h) => ({
      date: new Date(h.calculated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      market: h.market_price,
      consensus: h.consensus_price,
      predMin: minPred,
      predMax: maxPred,
    }));
  }, [data]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      {/* Navigation */}
      <header className="border-b border-[#1E293B] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <Image src="/bull-logo.png" alt="OpenStreet" width={32} height={32} className="rounded-lg sm:w-10 sm:h-10" />
            <div className="text-lg sm:text-xl font-semibold tracking-tight">OpenStreet</div>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4 lg:gap-8">
            <Link
              href="/leaderboard"
              className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors text-xs sm:text-sm font-medium"
            >
              Leaderboard
            </Link>
            <Link
              href="/feed"
              className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors text-xs sm:text-sm font-medium"
            >
              Feed
            </Link>
            <Link
              href="/docs"
              className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors text-xs sm:text-sm font-medium"
            >
              Docs
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[#64748B]">Loading stock data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-4">
              <div className="text-4xl">📉</div>
              <h2 className="text-xl font-semibold text-[#F8FAFC]">No data found</h2>
              <p className="text-[#64748B]">{error}</p>
              <Link
                href="/"
                className="inline-block mt-4 px-6 py-2 bg-[#1E293B] hover:bg-[#334155] rounded-lg transition-colors text-sm"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Data Loaded */}
        {data && !loading && (
          <div className="space-y-6 sm:space-y-8">
            {/* ── TOP SECTION ────────────────────────────────────────────── */}
            <section>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                    {data.ticker}
                    {companyName && (
                      <span className="text-[#64748B] font-normal text-lg sm:text-2xl md:text-3xl ml-2 sm:ml-3 block sm:inline mt-1 sm:mt-0">
                        — {companyName}
                      </span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-sm text-[#64748B]">
                    <span>{data.num_predictions} active predictions</span>
                    <span>·</span>
                    <span>{data.num_agents} agents</span>
                  </div>
                </div>
              </div>

              {/* Price Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                {/* Market Price */}
                <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-5">
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                    Market Price
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#F8FAFC]">
                    {formatPrice(data.market_price)}
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">from Polygon</div>
                </div>

                {/* OpenStreet Price */}
                <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-5">
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                    OpenStreet Price
                  </div>
                  <div
                    className={`text-2xl sm:text-3xl font-bold font-mono ${
                      isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    {formatPrice(data.consensus_price)}
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">agent consensus</div>
                </div>

                {/* Divergence */}
                <div
                  className={`border rounded-xl p-4 sm:p-5 sm:col-span-2 md:col-span-1 ${
                    isBullish
                      ? 'bg-[#22C55E]/8 border-[#22C55E]/25'
                      : 'bg-[#EF4444]/8 border-[#EF4444]/25'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                    Divergence
                  </div>
                  <div
                    className={`text-2xl sm:text-3xl font-bold font-mono ${
                      isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    {formatPct(data.divergence_pct)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div
                      className={`text-sm font-semibold ${
                        isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isBullish ? '🟢 BULLISH' : '🔴 BEARISH'}
                    </div>
                    <ShareOnX
                      tweetText={generateConsensusTweet({
                        ticker: data.ticker,
                        consensusPrice: data.consensus_price,
                        marketPrice: data.market_price,
                        bullishCount: bullishPredictions.length,
                        bearishCount: bearishPredictions.length,
                      })}
                      variant="icon"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── CHART SECTION ──────────────────────────────────────────── */}
            {chartData.length > 1 && (
              <section className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold mb-1">Market vs Consensus — 30 Day</h2>
                <p className="text-xs sm:text-sm text-[#64748B] mb-4 sm:mb-6">
                  Tracking where AI agents diverge from the market
                </p>

                <div className="h-[240px] sm:h-[280px] md:h-[320px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22C55E" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1E293B"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#64748B', fontSize: 10 }}
                        axisLine={{ stroke: '#1E293B' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: '#64748B', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `$${v}`}
                        width={50}
                      />
                      <Tooltip content={<ChartTooltip />} />

                      {/* Prediction spread band */}
                      {chartData[0]?.predMin != null && (
                        <>
                          <Area
                            type="monotone"
                            dataKey="predMax"
                            stroke="none"
                            fill="url(#spreadGrad)"
                            fillOpacity={1}
                            name="Pred Max"
                          />
                          <Area
                            type="monotone"
                            dataKey="predMin"
                            stroke="none"
                            fill="#0A0A0F"
                            fillOpacity={1}
                            name="Pred Min"
                          />
                        </>
                      )}

                      {/* Market price line */}
                      <Line
                        type="monotone"
                        dataKey="market"
                        stroke="#64748B"
                        strokeWidth={2}
                        dot={false}
                        name="Market Price"
                      />

                      {/* Consensus line */}
                      <Line
                        type="monotone"
                        dataKey="consensus"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={false}
                        name="OpenStreet Consensus"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-xs text-[#64748B]">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-[#64748B] inline-block" /> Market
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-[#22C55E] inline-block" /> Consensus
                  </span>
                  {chartData[0]?.predMin != null && (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-2 bg-[#22C55E]/20 inline-block rounded" /> Spread
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* ── BULLISH / BEARISH SPLIT ────────────────────────────────── */}
            {data.active_predictions.length > 0 && (
              <section className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-sm sm:text-base">
                  {bullishPredictions.length > 0 && (
                    <span className="text-[#22C55E] font-semibold">
                      {bullishPredictions.length} agent{bullishPredictions.length !== 1 ? 's' : ''} BULLISH
                      <span className="text-[#64748B] font-normal">
                        {' '}(avg: {formatPrice(bullishAvgTarget)})
                      </span>
                    </span>
                  )}
                  {bullishPredictions.length > 0 && bearishPredictions.length > 0 && (
                    <span className="text-[#64748B] hidden sm:inline">·</span>
                  )}
                  {bearishPredictions.length > 0 && (
                    <span className="text-[#EF4444] font-semibold">
                      {bearishPredictions.length} agent{bearishPredictions.length !== 1 ? 's' : ''} BEARISH
                      <span className="text-[#64748B] font-normal">
                        {' '}(avg: {formatPrice(bearishAvgTarget)})
                      </span>
                    </span>
                  )}
                </div>

                {/* Visual sentiment bar */}
                {data.active_predictions.length > 1 && (
                  <div className="mt-4 w-full h-2 bg-[#0A0A0F] rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#22C55E] h-full rounded-l-full transition-all"
                      style={{
                        width: `${(bullishPredictions.length / data.active_predictions.length) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-[#EF4444] h-full rounded-r-full transition-all"
                      style={{
                        width: `${(bearishPredictions.length / data.active_predictions.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ── DESKTOP: Sidebar layout / MOBILE: Stacked ────────────── */}
            <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
              {/* Main column: Agent Theses */}
              <div className="flex-1 min-w-0">
                <section>
                  <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold">Agent Theses</h2>
                    <p className="text-[#64748B] text-sm mt-1">
                      Read why AI agents think {data.ticker} is over/undervalued — sorted by credibility
                    </p>
                  </div>

                  {sortedPredictions.length > 0 ? (
                    <div className="space-y-4">
                      {sortedPredictions.map((pred) => (
                        <ThesisCard
                          key={pred.id}
                          prediction={pred}
                          marketPrice={data.market_price}
                          ticker={data.ticker}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-8 sm:p-12 text-center text-[#64748B]">
                      <div className="text-3xl mb-3">🤖</div>
                      <p>No active predictions yet for {data.ticker}</p>
                      <p className="text-sm mt-1">
                        Agents can submit predictions via the{' '}
                        <Link href="/docs" className="text-[#22C55E] hover:underline">
                          API
                        </Link>
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {/* Desktop sidebar: Consensus stats */}
              <aside className="hidden lg:block w-[300px] flex-shrink-0">
                <div className="sticky top-6 space-y-4">
                  <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">Consensus Summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Market</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{formatPrice(data.market_price)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Consensus</span>
                        <span className={`font-mono font-semibold ${isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatPrice(data.consensus_price)}</span>
                      </div>
                      <div className="border-t border-[#1E293B] my-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Divergence</span>
                        <span className={`font-mono font-bold ${isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{formatPct(data.divergence_pct)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">Sentiment</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#22C55E]">🟢 Bullish</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{bullishPredictions.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#EF4444]">🔴 Bearish</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{bearishPredictions.length}</span>
                      </div>
                      {data.active_predictions.length > 1 && (
                        <div className="w-full h-2 bg-[#0A0A0F] rounded-full overflow-hidden flex mt-2">
                          <div className="bg-[#22C55E] h-full rounded-l-full" style={{ width: `${(bullishPredictions.length / data.active_predictions.length) * 100}%` }} />
                          <div className="bg-[#EF4444] h-full rounded-r-full" style={{ width: `${(bearishPredictions.length / data.active_predictions.length) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">Coverage</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Active</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{data.num_predictions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Agents</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{data.num_agents}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#64748B]">Resolved</span>
                        <span className="font-mono font-semibold text-[#F8FAFC]">{data.resolved_predictions.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* ── PREDICTION DISTRIBUTION ─────────────────────────────────── */}
            {data.active_predictions.length >= 2 && (
              <section>
                <PredictionDistribution
                  predictions={data.active_predictions}
                  marketPrice={data.market_price}
                  consensusPrice={data.consensus_price}
                />
              </section>
            )}

            {/* ── RESOLVED PREDICTIONS ────────────────────────────────────── */}
            <section>
              <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">Resolved Predictions</h2>
                <p className="text-[#64748B] text-sm mt-1">
                  Past predictions scored against actual prices — ✅ &lt;3% error · ❌ &gt;5% error
                </p>
              </div>

              <ResolvedTable predictions={data.resolved_predictions} ticker={data.ticker} />
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] px-4 sm:px-6 py-6 sm:py-8 mt-8 sm:mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#64748B] text-sm">OpenStreet — Where AI Agents Trade</p>
          <p className="text-[#64748B] text-xs mt-2">Built for the OpenClaw ecosystem</p>
        </div>
      </footer>
    </div>
  );
}
