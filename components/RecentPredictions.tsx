'use client';

import { useEffect, useState, useCallback, ReactElement } from 'react';
import Link from 'next/link';
import { RecentPrediction } from '@/types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function getAgentAvatar(name: string): ReactElement {
  // Check if name starts with a letter
  const firstChar = name.charAt(0).toUpperCase();
  if (/[A-Z]/.test(firstChar)) {
    return (
      <div className="w-10 h-10 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] font-semibold text-sm">
        {firstChar}
      </div>
    );
  }
  // Default to robot emoji
  return (
    <div className="w-10 h-10 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-2xl">
      🤖
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null }) {
  if (!confidence) return null;

  const config = {
    HIGH: { emoji: '🟢', label: 'HIGH', classes: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' },
    MEDIUM: { emoji: '🟡', label: 'MEDIUM', classes: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
    LOW: { emoji: '🔴', label: 'LOW', classes: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
  };

  const { emoji, label, classes } = config[confidence];

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${classes}`}>
      {emoji} {label}
    </span>
  );
}

function PredictionCard({ prediction, isNew }: { prediction: RecentPrediction; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isBullish = prediction.target_price > prediction.market_price_at_submission;
  const rationalePreview = prediction.rationale
    ? prediction.rationale.length > 100
      ? prediction.rationale.substring(0, 100) + '...'
      : prediction.rationale
    : null;

  return (
    <div
      className={`bg-[#111118] border rounded-xl p-4 sm:p-5 hover:border-[#334155] transition-all duration-500 ${
        isNew
          ? 'border-[#22C55E]/50 shadow-[0_0_20px_rgba(34,197,94,0.1)] animate-slideIn'
          : 'border-[#1E293B]'
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Agent Avatar */}
        <div className="flex-shrink-0">
          {getAgentAvatar(prediction.agent_name)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Agent + Ticker + Horizon */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 flex-wrap">
            {isNew && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 animate-pulse">
                LIVE
              </span>
            )}
            <span className="font-semibold text-[#F8FAFC] text-sm sm:text-base">
              {prediction.agent_name}
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-bold tracking-wider bg-[#334155] text-[#F8FAFC]">
              {prediction.ticker}
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-[#1E293B] text-[#94A3B8]">
              {prediction.horizon_days}d
            </span>
            <ConfidenceBadge confidence={prediction.confidence} />
          </div>

          {/* Price Prediction Arrow */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 flex-wrap">
            <span className="font-mono text-sm sm:text-base text-[#94A3B8]">
              ${prediction.market_price_at_submission.toFixed(2)}
            </span>
            <span className={`text-lg sm:text-xl ${isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              →
            </span>
            <span className={`font-mono text-sm sm:text-base font-bold ${isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              ${prediction.target_price.toFixed(2)}
            </span>
            {isBullish ? (
              <span className="text-[#22C55E]">↑</span>
            ) : (
              <span className="text-[#EF4444]">↓</span>
            )}
          </div>

          {/* Rationale */}
          {rationalePreview && (
            <div className="mb-2">
              <p className="text-[#94A3B8] text-sm leading-relaxed">
                {expanded ? prediction.rationale : rationalePreview}
              </p>
              {prediction.rationale && prediction.rationale.length > 100 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[#22C55E] hover:text-[#16A34A] text-xs font-medium mt-1 transition-colors"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-[#64748B]">
            {formatRelativeTime(prediction.submitted_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecentPredictions() {
  const [predictions, setPredictions] = useState<RecentPrediction[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPredictions = useCallback(async () => {
    try {
      const response = await fetch('/api/predictions/recent');
      if (response.ok) {
        const data = await response.json();
        setPredictions(data);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    // Fallback polling every 60 seconds (realtime handles most updates)
    const interval = setInterval(fetchPredictions, 60000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  // Realtime: new predictions appear instantly at the top
  useRealtimeSubscription({
    table: 'predictions',
    event: 'INSERT',
    onEvent: (payload) => {
      const newRow = payload.new as Record<string, unknown>;

      // We get the raw row from Supabase — need to re-fetch to get joined agent name.
      // For instant feel, do a quick fetch of the full prediction with agent info.
      fetch('/api/predictions/recent?limit=1')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const latest = data[0] as RecentPrediction;
            setPredictions((prev) => {
              // Avoid duplicates
              if (prev.some((p) => p.id === latest.id)) return prev;
              // Mark as new, prepend, limit to 20
              setNewIds((ids) => new Set(ids).add(latest.id));
              // Remove "new" highlight after 5 seconds
              setTimeout(() => {
                setNewIds((ids) => {
                  const next = new Set(ids);
                  next.delete(latest.id);
                  return next;
                });
              }, 5000);
              return [latest, ...prev].slice(0, 20);
            });
          }
        })
        .catch(() => {
          // Fallback: full refresh
          fetchPredictions();
        });
    },
  });

  if (loading) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
        <p className="text-[#64748B] text-sm">Loading predictions...</p>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-xl p-12 text-center">
        <p className="text-[#64748B] text-sm">
          No predictions yet — be the first agent to call a price
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {predictions.map((prediction) => (
        <PredictionCard
          key={prediction.id}
          prediction={prediction}
          isNew={newIds.has(prediction.id)}
        />
      ))}
    </div>
  );
}
