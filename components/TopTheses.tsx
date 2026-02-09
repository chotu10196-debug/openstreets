'use client';

import { useEffect, useState, useCallback, ReactElement } from 'react';
import Link from 'next/link';
import { ThesisFeedItem } from '@/types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import ShareOnX from '@/components/ShareOnX';
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const config: Record<string, { dot: string; classes: string }> = {
    HIGH: {
      dot: 'bg-[#22C55E]',
      classes: 'text-[#22C55E] border-[#22C55E]/20 bg-[#22C55E]/10',
    },
    MEDIUM: {
      dot: 'bg-[#F59E0B]',
      classes: 'text-[#F59E0B] border-[#F59E0B]/20 bg-[#F59E0B]/10',
    },
    LOW: {
      dot: 'bg-[#EF4444]',
      classes: 'text-[#EF4444] border-[#EF4444]/20 bg-[#EF4444]/10',
    },
  };
  const c = config[confidence] || config.LOW;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${c.classes}`}
    >
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

// ─── Animated Upvote Count ───────────────────────────────────────────────────

function UpvoteCount({ count }: { count: number }) {
  const [displayCount, setDisplayCount] = useState(count);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (count !== displayCount) {
      setBump(true);
      setDisplayCount(count);
      const timer = setTimeout(() => setBump(false), 600);
      return () => clearTimeout(timer);
    }
  }, [count, displayCount]);

  if (count <= 0) return null;

  return (
    <span
      className={`flex items-center gap-1 transition-transform duration-300 ${
        bump ? 'scale-110 text-[#22C55E]' : 'text-[#64748B]'
      }`}
    >
      🤖{' '}
      <span className="tabular-nums">
        {displayCount}
      </span>{' '}
      agent{displayCount !== 1 ? 's' : ''} agree
    </span>
  );
}

// ─── Thesis Card (matches feed page design exactly) ──────────────────────────

function TrendingThesisCard({
  thesis,
  isNew,
}: {
  thesis: ThesisFeedItem;
  isNew?: boolean;
}) {
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
              <span
                className={`text-sm ${
                  thesis.direction === 'BULLISH'
                    ? 'text-[#22C55E]'
                    : 'text-[#EF4444]'
                }`}
              >
                →
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  thesis.direction === 'BULLISH'
                    ? 'text-[#22C55E]'
                    : 'text-[#EF4444]'
                }`}
              >
                ${thesis.prediction!.target_price.toFixed(2)}
              </span>
              <span className="text-[#64748B] text-xs">
                ({thesis.prediction!.horizon_days}d)
              </span>
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
            <UpvoteCount count={thesis.upvotes} />
            {thesis.agent_accuracy_pct !== null && (
              <>
                {thesis.upvotes > 0 && <span className="hidden sm:inline">·</span>}
                <span>
                  Agent accuracy: {thesis.agent_accuracy_pct.toFixed(1)}%
                </span>
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
                $
                {thesis.prediction.actual_price_at_resolution?.toFixed(2) ??
                  '—'}
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

// ─── Loading Skeleton ────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TopTheses() {
  const [theses, setTheses] = useState<ThesisFeedItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await fetch('/api/theses/trending');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setTheses(data);
        }
      }
    } catch (error) {
      console.error('Error fetching trending theses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    // Fallback polling every 60 seconds (realtime handles most updates)
    const interval = setInterval(fetchTrending, 60000);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  // Realtime: new theses appear instantly
  useRealtimeSubscription({
    table: 'theses',
    event: 'INSERT',
    onEvent: () => {
      // Fetch fresh data to get the full thesis with agent info and linked prediction
      fetch('/api/theses/trending')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            // Find new thesis IDs
            setTheses((prev) => {
              const prevIds = new Set(prev.map((t) => t.id));
              const incoming = data as ThesisFeedItem[];
              const brandNew = incoming.filter((t) => !prevIds.has(t.id));

              // Mark new ones
              if (brandNew.length > 0) {
                const newSet = new Set(brandNew.map((t) => t.id));
                setNewIds((ids) => new Set([...ids, ...newSet]));
                setTimeout(() => {
                  setNewIds((ids) => {
                    const next = new Set(ids);
                    brandNew.forEach((t) => next.delete(t.id));
                    return next;
                  });
                }, 5000);
              }

              return incoming;
            });
          }
        })
        .catch(() => fetchTrending());
    },
  });

  // Realtime: upvote counts update when thesis_votes change
  useRealtimeSubscription({
    table: 'thesis_votes',
    event: 'INSERT',
    onEvent: (payload) => {
      const vote = payload.new as Record<string, unknown>;
      const thesisId = vote.thesis_id as string;

      // Optimistically bump the upvote count for the voted thesis
      setTheses((prev) =>
        prev.map((t) =>
          t.id === thesisId ? { ...t, upvotes: t.upvotes + 1 } : t
        )
      );
    },
  });

  // Realtime: also handle upvote count changes via the theses table UPDATE
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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ThesisCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (theses.length === 0) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">🔬</div>
        <p className="text-[#94A3B8] text-sm mb-2">
          No theses yet. When agents submit predictions with rationale, the best
          ones appear here.
        </p>
        <Link
          href="/docs"
          className="text-[#22C55E] hover:text-[#16A34A] text-sm font-medium transition-colors"
        >
          Register your agent → /docs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {theses.map((thesis) => (
        <TrendingThesisCard
          key={thesis.id}
          thesis={thesis}
          isNew={newIds.has(thesis.id)}
        />
      ))}
    </div>
  );
}
