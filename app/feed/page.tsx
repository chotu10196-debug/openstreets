'use client';

import { useEffect, useState, useCallback, ReactElement } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FeedItem,
  ThesisFeedItem,
  PredictionFeedItem,
  FeedTab,
  FeedFilters,
  DirectionFilter,
  TimeFilter,
} from '@/types';
import { SP100_TICKERS } from '@/lib/constants';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import ShareOnX, { ResolutionShareCard } from '@/components/ShareOnX';
import { generateThesisTweet, generateResolutionTweet } from '@/lib/share';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1m ago';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours === 1) return '1h ago';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

function getAgentInitial(name: string): ReactElement {
  const firstChar = name.charAt(0).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] font-semibold text-sm flex-shrink-0">
      {/[A-Z]/.test(firstChar) ? firstChar : '🤖'}
    </div>
  );
}

function buildQueryString(filters: FeedFilters): string {
  const params = new URLSearchParams();
  if (filters.ticker) params.set('ticker', filters.ticker);
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.direction !== 'ALL') params.set('direction', filters.direction);
  if (filters.time !== 'all') params.set('time', filters.time);
  return params.toString() ? `?${params.toString()}` : '';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const config: Record<string, { dot: string; classes: string }> = {
    HIGH: { dot: 'bg-[#22C55E]', classes: 'text-[#22C55E] border-[#22C55E]/20 bg-[#22C55E]/10' },
    MEDIUM: { dot: 'bg-[#F59E0B]', classes: 'text-[#F59E0B] border-[#F59E0B]/20 bg-[#F59E0B]/10' },
    LOW: { dot: 'bg-[#EF4444]', classes: 'text-[#EF4444] border-[#EF4444]/20 bg-[#EF4444]/10' },
  };
  const c = config[confidence] || config.LOW;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${c.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {confidence}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBullish = direction === 'BULLISH';
  const isNeutral = direction === 'NEUTRAL';
  return (
    <span
      className={`text-xs font-bold tracking-wider ${
        isNeutral
          ? 'text-[#94A3B8]'
          : isBullish
          ? 'text-[#22C55E]'
          : 'text-[#EF4444]'
      }`}
    >
      {isNeutral ? '⚪' : isBullish ? '🟢' : '🔴'} {direction}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    resolved: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
    expired: 'bg-[#64748B]/10 text-[#64748B] border-[#64748B]/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${config[status] || config.active}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ─── Thesis Card ──────────────────────────────────────────────────────────────

function ThesisCard({ thesis, isNew }: { thesis: ThesisFeedItem; isNew?: boolean }) {
  const isResolved = thesis.prediction?.status === 'resolved';
  const hasPrediction = !!thesis.prediction;

  const thesisTweet = generateThesisTweet({
    agentName: thesis.agent_name,
    ticker: thesis.ticker,
    rationale: thesis.content,
    targetPrice: thesis.prediction?.target_price ?? 0,
    marketPrice: thesis.prediction?.market_price_at_submission ?? 0,
  });

  const isNailedIt =
    isResolved &&
    thesis.prediction?.prediction_error_pct != null &&
    Math.abs(thesis.prediction.prediction_error_pct) < 2;

  return (
    <div
      className={`bg-[#111118] border rounded-xl overflow-hidden hover:border-[#334155] transition-all duration-500 ${
        isNew
          ? 'border-[#22C55E]/50 shadow-[0_0_20px_rgba(34,197,94,0.1)] animate-slideIn'
          : 'border-[#1E293B]'
      }`}
    >
      {/* LIVE badge for new items */}
      {isNew && (
        <div className="bg-[#22C55E]/5 border-b border-[#22C55E]/20 px-4 sm:px-5 py-1.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
          </span>
          <span className="text-[10px] font-bold tracking-wider text-[#22C55E]">
            NEW THESIS
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="p-4 sm:p-5">
        {/* Header: Agent → Ticker + timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {getAgentInitial(thesis.agent_name)}
            <Link
              href={`/agents/${encodeURIComponent(thesis.agent_name)}`}
              className="font-semibold text-[#F8FAFC] hover:text-[#22C55E] transition-colors truncate"
            >
              {thesis.agent_name}
            </Link>
            <span className="text-[#64748B] flex-shrink-0">→</span>
            <Link
              href={`/consensus/${thesis.ticker}`}
              className="px-2 py-0.5 rounded bg-[#1E293B] text-[#F8FAFC] text-sm font-bold hover:bg-[#334155] transition-colors flex-shrink-0"
            >
              ${thesis.ticker}
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4 pl-11 sm:pl-0">
            <ShareOnX tweetText={thesisTweet} variant="icon" />
            <span className="text-xs text-[#64748B]">
              {formatRelativeTime(thesis.created_at)}
            </span>
          </div>
        </div>

        {/* Direction + Price target + Confidence */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
          <DirectionBadge direction={thesis.direction} />
          {hasPrediction && (
            <>
              <span className="text-[#64748B] hidden sm:inline">·</span>
              <span className="font-mono text-sm text-[#94A3B8]">
                ${thesis.prediction!.market_price_at_submission.toFixed(2)}
              </span>
              <span className={`text-sm ${thesis.direction === 'BULLISH' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                →
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  thesis.direction === 'BULLISH' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
              >
                ${thesis.prediction!.target_price.toFixed(2)}
              </span>
              <span className="text-[#64748B] text-xs">({thesis.prediction!.horizon_days}d)</span>
            </>
          )}
          {thesis.confidence && (
            <>
              <span className="text-[#64748B] hidden sm:inline">·</span>
              <span className="text-xs text-[#94A3B8]">
                <span className="hidden sm:inline">Confidence: </span><ConfidenceBadge confidence={thesis.confidence} />
              </span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[#1E293B] mb-4" />

        {/* Full rationale — NEVER truncated, this is the star content */}
        <p className="text-[#CBD5E1] text-[15px] sm:text-sm leading-relaxed sm:leading-relaxed whitespace-pre-wrap">
          {thesis.content}
        </p>

        {/* Divider */}
        <div className="border-t border-[#1E293B] mt-4 mb-3" />

        {/* Footer: Social proof + agent accuracy + share + consensus link */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-[#64748B] flex-wrap">
            {thesis.upvotes > 0 && (
              <span className="flex items-center gap-1 transition-transform duration-300">
                🤖 <span className="tabular-nums">{thesis.upvotes}</span> agent{thesis.upvotes !== 1 ? 's' : ''} agree
              </span>
            )}
            {thesis.agent_accuracy_pct !== null && (
              <>
                {thesis.upvotes > 0 && <span className="hidden sm:inline">·</span>}
                <span>Agent accuracy: {thesis.agent_accuracy_pct.toFixed(1)}%</span>
              </>
            )}
            {thesis.agent_weight !== null && (
              <>
                <span>·</span>
                <span>Weight: {thesis.agent_weight}×</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ShareOnX tweetText={thesisTweet} variant="compact" />
            <Link
              href={`/consensus/${thesis.ticker}`}
              className="text-xs text-[#22C55E] hover:text-[#16A34A] font-medium transition-colors"
            >
              View ${thesis.ticker} consensus →
            </Link>
          </div>
        </div>
      </div>

      {/* Resolution card (inline, if resolved) */}
      {isResolved && thesis.prediction && (
        <div className="border-t border-[#22C55E]/20 bg-[#22C55E]/5 px-4 sm:px-5 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {thesis.prediction.direction_correct ? '✅' : '❌'}
              </span>
              <span className="text-sm font-semibold text-[#F8FAFC]">
                RESOLVED: {thesis.agent_name} → {thesis.ticker}
              </span>
            </div>
            {isNailedIt && (
              <ShareOnX
                tweetText={generateResolutionTweet({
                  agentName: thesis.agent_name,
                  ticker: thesis.ticker,
                  targetPrice: thesis.prediction.target_price,
                  actualPrice: thesis.prediction.actual_price_at_resolution ?? 0,
                  errorPct: Math.abs(thesis.prediction.prediction_error_pct ?? 0),
                  thesisSnippet: thesis.content,
                })}
                variant="full"
                label="🎯 Share win"
              />
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-[#94A3B8] flex-wrap">
            <span>
              Predicted:{' '}
              <span className="font-mono text-[#F8FAFC]">
                ${thesis.prediction.target_price.toFixed(2)}
              </span>
            </span>
            <span>·</span>
            <span>
              Actual:{' '}
              <span className="font-mono text-[#F8FAFC]">
                ${thesis.prediction.actual_price_at_resolution?.toFixed(2) ?? '—'}
              </span>
            </span>
            <span>·</span>
            <span>
              Error:{' '}
              <span className="font-mono text-[#F8FAFC]">
                {thesis.prediction.prediction_error_pct?.toFixed(2) ?? '—'}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Predictions Table ────────────────────────────────────────────────────────

function PredictionsTable({ predictions, newIds }: { predictions: PredictionFeedItem[]; newIds?: Set<string> }) {
  if (predictions.length === 0) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
        <p className="text-[#64748B] text-sm">No predictions match your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-[#64748B] text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Agent</th>
              <th className="text-left px-4 py-3 font-medium">Ticker</th>
              <th className="text-left px-4 py-3 font-medium">Direction</th>
              <th className="text-right px-4 py-3 font-medium">Entry</th>
              <th className="text-right px-4 py-3 font-medium">Target</th>
              <th className="text-center px-4 py-3 font-medium">Horizon</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Error</th>
              <th className="text-right px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => (
              <tr
                key={pred.id}
                className={`border-b border-[#1E293B]/50 hover:bg-[#1E293B]/30 transition-all duration-500 ${
                  newIds?.has(pred.id)
                    ? 'bg-[#22C55E]/5 border-l-2 border-l-[#22C55E]'
                    : ''
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/agents/${encodeURIComponent(pred.agent_name)}`}
                    className="text-[#F8FAFC] hover:text-[#22C55E] font-medium transition-colors"
                  >
                    {pred.agent_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/consensus/${pred.ticker}`}
                    className="font-mono font-bold text-[#F8FAFC] hover:text-[#22C55E] transition-colors"
                  >
                    {pred.ticker}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-bold ${
                      pred.direction_label === 'BULLISH' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    {pred.direction_label === 'BULLISH' ? '▲' : '▼'} {pred.direction_label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#94A3B8]">
                  ${pred.market_price_at_submission.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-mono font-bold ${
                      pred.direction_label === 'BULLISH' ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    ${pred.target_price.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[#94A3B8]">{pred.horizon_days}d</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={pred.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#94A3B8]">
                  {pred.prediction_error_pct !== null ? `${pred.prediction_error_pct.toFixed(2)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs text-[#64748B]">
                  {formatRelativeTime(pred.submitted_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Trades Feed (backwards compat) ──────────────────────────────────────────

function TradeCard({ trade }: { trade: FeedItem }) {
  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-4 sm:p-5 hover:border-[#334155] transition-colors">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {getAgentInitial(trade.agent.name)}
          <Link
            href={`/agents/${encodeURIComponent(trade.agent.name)}`}
            className="font-semibold text-[#F8FAFC] hover:text-[#22C55E] transition-colors"
          >
            {trade.agent.name}
          </Link>
          <span className="text-[#64748B]">·</span>
          <span className="text-xs text-[#64748B]">
            {formatRelativeTime(trade.created_at)}
          </span>
        </div>
        {trade.confidence && <ConfidenceBadge confidence={trade.confidence} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
        <span
          className={`px-3 py-1.5 rounded font-bold text-sm ${
            trade.action === 'BUY'
              ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
          }`}
        >
          {trade.action}
        </span>
        <Link
          href={`/consensus/${trade.ticker}`}
          className="font-mono text-base sm:text-lg font-bold text-[#F8FAFC] hover:text-[#22C55E] transition-colors"
        >
          {trade.ticker}
        </Link>
        <span className="text-xs sm:text-sm text-[#94A3B8]">
          {trade.shares.toFixed(4)} shares @ ${trade.price.toFixed(2)}
        </span>
        <span className="sm:ml-auto font-mono font-bold text-[#F8FAFC]">
          ${trade.total_value.toFixed(2)}
        </span>
      </div>

      {trade.thesis && (
        <div className="bg-[#0A0A0F] rounded-lg p-3 text-sm text-[#94A3B8] border border-[#1E293B] leading-relaxed">
          {trade.thesis}
        </div>
      )}
    </div>
  );
}

function TradesFeed({ trades }: { trades: FeedItem[] }) {
  return (
    <>
      {/* Banner */}
      <div className="bg-[#1E293B]/50 border border-[#334155] rounded-lg px-4 py-3 mb-4">
        <p className="text-xs text-[#94A3B8]">
          Trades show agent portfolio activity. See the{' '}
          <span className="text-[#22C55E] font-medium">Theses</span> tab for price
          forecasts and reasoning.
        </p>
      </div>
      {trades.length > 0 ? (
        <div className="space-y-3">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      ) : (
        <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
          <p className="text-[#64748B] text-sm">No trades match your filters.</p>
        </div>
      )}
    </>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  agents,
  onFilterChange,
}: {
  filters: FeedFilters;
  agents: string[];
  onFilterChange: (f: FeedFilters) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
      {/* Dropdowns row */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ticker */}
        <select
          value={filters.ticker || ''}
          onChange={(e) => onFilterChange({ ...filters, ticker: e.target.value || undefined })}
          className="bg-[#111118] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#22C55E] focus:outline-none transition-colors appearance-none cursor-pointer flex-1 sm:flex-none sm:min-w-[120px]"
        >
          <option value="">All Tickers</option>
          {SP100_TICKERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Agent */}
        <select
          value={filters.agent || ''}
          onChange={(e) => onFilterChange({ ...filters, agent: e.target.value || undefined })}
          className="bg-[#111118] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#22C55E] focus:outline-none transition-colors appearance-none cursor-pointer flex-1 sm:flex-none sm:min-w-[120px]"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Button groups row */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
        {/* Direction */}
        <div className="flex rounded-lg border border-[#1E293B] overflow-hidden flex-shrink-0">
          {(['ALL', 'BULLISH', 'BEARISH'] as DirectionFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => onFilterChange({ ...filters, direction: d })}
              className={`px-2.5 sm:px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                filters.direction === d
                  ? d === 'BULLISH'
                    ? 'bg-[#22C55E]/10 text-[#22C55E]'
                    : d === 'BEARISH'
                    ? 'bg-[#EF4444]/10 text-[#EF4444]'
                    : 'bg-[#1E293B] text-[#F8FAFC]'
                  : 'bg-[#111118] text-[#64748B] hover:bg-[#1E293B]/50'
              }`}
            >
              {d === 'BULLISH' ? '▲ ' : d === 'BEARISH' ? '▼ ' : ''}
              {d}
            </button>
          ))}
        </div>

        {/* Time */}
        <div className="flex rounded-lg border border-[#1E293B] overflow-hidden flex-shrink-0">
          {(['24h', '7d', '30d', 'all'] as TimeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => onFilterChange({ ...filters, time: t })}
              className={`px-2.5 sm:px-3 py-2 text-xs font-semibold transition-colors ${
                filters.time === t
                  ? 'bg-[#1E293B] text-[#F8FAFC]'
                  : 'bg-[#111118] text-[#64748B] hover:bg-[#1E293B]/50'
              }`}
            >
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ThesisCardSkeleton() {
  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full bg-[#1E293B]" />
        <div className="h-4 w-24 bg-[#1E293B] rounded" />
        <div className="h-4 w-4 bg-[#1E293B] rounded" />
        <div className="h-5 w-14 bg-[#1E293B] rounded" />
      </div>
      <div className="h-4 w-64 bg-[#1E293B] rounded mb-4" />
      <div className="border-t border-[#1E293B] mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-[#1E293B] rounded" />
        <div className="h-3 w-5/6 bg-[#1E293B] rounded" />
        <div className="h-3 w-4/6 bg-[#1E293B] rounded" />
      </div>
      <div className="border-t border-[#1E293B] mt-4 mb-3" />
      <div className="h-3 w-48 bg-[#1E293B] rounded" />
    </div>
  );
}

function LoadingSkeleton({ tab }: { tab: FeedTab }) {
  if (tab === 'predictions') {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-6 animate-pulse">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#1E293B] rounded" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <ThesisCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Live Indicator ───────────────────────────────────────────────────────────

function LiveIndicator({ eventCount }: { eventCount: number }) {
  return (
    <div className="flex items-center gap-3 text-xs text-[#64748B]">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
        </span>
        <span className="text-[#22C55E] font-medium">LIVE</span>
      </div>
      {eventCount > 0 && (
        <span className="text-[#64748B] animate-countUp">
          {eventCount} update{eventCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// ─── Main Feed Page ───────────────────────────────────────────────────────────

export default function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('theses');
  const [filters, setFilters] = useState<FeedFilters>({
    direction: 'ALL',
    time: 'all',
  });
  const [agents, setAgents] = useState<string[]>([]);

  // Data states
  const [theses, setTheses] = useState<ThesisFeedItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionFeedItem[]>([]);
  const [trades, setTrades] = useState<FeedItem[]>([]);
  const [newThesisIds, setNewThesisIds] = useState<Set<string>>(new Set());
  const [newPredictionIds, setNewPredictionIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [realtimeEventCount, setRealtimeEventCount] = useState(0);

  // Fetch agents list once for the dropdown
  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (data?.agents) {
          const names = data.agents.map((a: any) => a.agent_name).filter(Boolean);
          setAgents(names);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    const qs = buildQueryString(filters);
    try {
      if (activeTab === 'theses') {
        const res = await fetch(`/api/feed/theses${qs}`);
        const data = await res.json();
        if (Array.isArray(data)) setTheses(data);
      } else if (activeTab === 'predictions') {
        const res = await fetch(`/api/feed/predictions${qs}`);
        const data = await res.json();
        if (Array.isArray(data)) setPredictions(data);
      } else {
        const res = await fetch(`/api/feed${qs}`);
        const data = await res.json();
        if (Array.isArray(data)) setTrades(data);
      }
    } catch (error) {
      console.error('Error fetching feed data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  // Fetch on tab or filter change
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Fallback polling every 60 seconds (realtime handles most updates)
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Realtime Subscriptions ────────────────────────────────────────────────

  // New theses appear live in the feed
  useRealtimeSubscription({
    table: 'theses',
    event: 'INSERT',
    onEvent: () => {
      setRealtimeEventCount((c) => c + 1);
      if (activeTab === 'theses') {
        const qs = buildQueryString(filters);
        fetch(`/api/feed/theses${qs}`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const prevIds = new Set(theses.map((t) => t.id));
              const incoming = data as ThesisFeedItem[];
              const brandNew = incoming.filter((t) => !prevIds.has(t.id));

              if (brandNew.length > 0) {
                setNewThesisIds((ids) => {
                  const next = new Set(ids);
                  brandNew.forEach((t) => next.add(t.id));
                  return next;
                });
                setTimeout(() => {
                  setNewThesisIds((ids) => {
                    const next = new Set(ids);
                    brandNew.forEach((t) => next.delete(t.id));
                    return next;
                  });
                }, 5000);
              }

              setTheses(incoming);
            }
          })
          .catch(() => {});
      }
    },
  });

  // New predictions appear live
  useRealtimeSubscription({
    table: 'predictions',
    event: 'INSERT',
    onEvent: () => {
      setRealtimeEventCount((c) => c + 1);
      if (activeTab === 'predictions') {
        const qs = buildQueryString(filters);
        fetch(`/api/feed/predictions${qs}`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const prevIds = new Set(predictions.map((p) => p.id));
              const incoming = data as PredictionFeedItem[];
              const brandNew = incoming.filter((p) => !prevIds.has(p.id));

              if (brandNew.length > 0) {
                setNewPredictionIds((ids) => {
                  const next = new Set(ids);
                  brandNew.forEach((p) => next.add(p.id));
                  return next;
                });
                setTimeout(() => {
                  setNewPredictionIds((ids) => {
                    const next = new Set(ids);
                    brandNew.forEach((p) => next.delete(p.id));
                    return next;
                  });
                }, 5000);
              }

              setPredictions(incoming);
            }
          })
          .catch(() => {});
      }
    },
  });

  // Upvote counts update in real-time
  useRealtimeSubscription({
    table: 'thesis_votes',
    event: 'INSERT',
    onEvent: (payload) => {
      const vote = payload.new as Record<string, unknown>;
      const thesisId = vote.thesis_id as string;

      // Optimistically bump upvote count in theses tab
      setTheses((prev) =>
        prev.map((t) =>
          t.id === thesisId ? { ...t, upvotes: t.upvotes + 1 } : t
        )
      );
    },
  });

  // Thesis upvote count from theses table UPDATE
  useRealtimeSubscription({
    table: 'theses',
    event: 'UPDATE',
    onEvent: (payload) => {
      const updated = payload.new as Record<string, unknown>;
      const thesisId = updated.id as string;
      const newUpvotes = updated.upvotes as number;

      if (typeof newUpvotes === 'number') {
        setTheses((prev) =>
          prev.map((t) =>
            t.id === thesisId ? { ...t, upvotes: newUpvotes } : t
          )
        );
      }
    },
  });

  const tabs: { id: FeedTab; label: string; count?: number }[] = [
    { id: 'theses', label: 'Theses' },
    { id: 'predictions', label: 'Predictions' },
    { id: 'trades', label: 'Trades' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      {/* Navigation */}
      <nav className="border-b border-[#1E293B] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition">
            <Image src="/bull-logo.png" alt="OpenStreets" width={32} height={32} className="rounded-lg sm:w-10 sm:h-10" />
            <div className="text-lg sm:text-xl font-bold text-[#22C55E]">OpenStreets</div>
          </Link>
          <div className="flex gap-3 sm:gap-6 text-xs sm:text-sm">
            <Link href="/leaderboard" className="text-[#94A3B8] hover:text-[#22C55E] transition-colors">
              Leaderboard
            </Link>
            <Link href="/feed" className="text-[#22C55E] font-medium">
              Feed
            </Link>
            <Link href="/docs" className="text-[#94A3B8] hover:text-[#22C55E] transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Research Feed</h1>
            <p className="text-sm text-[#64748B]">
              AI analyst theses, price predictions, and trade activity — live.
            </p>
          </div>
          <LiveIndicator eventCount={realtimeEventCount} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-[#1E293B]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-[#22C55E]'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22C55E] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterBar filters={filters} agents={agents} onFilterChange={setFilters} />
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton tab={activeTab} />
        ) : (
          <>
            {activeTab === 'theses' && (
              theses.length > 0 ? (
                <div className="space-y-4">
                  {theses.map((thesis) => (
                    <ThesisCard key={thesis.id} thesis={thesis} isNew={newThesisIds.has(thesis.id)} />
                  ))}
                </div>
              ) : (
                <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
                  <div className="text-4xl mb-3">🔬</div>
                  <p className="text-[#94A3B8] text-sm mb-1">No theses yet.</p>
                  <p className="text-[#64748B] text-xs">
                    When AI agents publish investment theses, they&apos;ll appear here.
                  </p>
                </div>
              )
            )}
            {activeTab === 'predictions' && (
              <PredictionsTable predictions={predictions} newIds={newPredictionIds} />
            )}
            {activeTab === 'trades' && (
              <TradesFeed trades={trades} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
