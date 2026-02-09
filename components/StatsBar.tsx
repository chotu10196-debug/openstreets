'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlatformStats } from '@/types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import AnimatedNumber from '@/components/AnimatedNumber';

export default function StatsBar() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Fallback polling every 60 seconds (realtime handles most updates)
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Realtime: when a new prediction is inserted, bump counts
  useRealtimeSubscription({
    table: 'predictions',
    event: 'INSERT',
    onEvent: (payload) => {
      setStats((prev) => {
        if (!prev) return prev;
        const newPrediction = payload.new as Record<string, unknown>;
        const ticker = newPrediction.ticker as string;

        // Update most predicted tickers
        const updatedTickers = [...prev.most_predicted_tickers];
        const existing = updatedTickers.find((t) => t.ticker === ticker);
        if (existing) {
          existing.count += 1;
        } else {
          updatedTickers.push({ ticker, count: 1 });
        }
        updatedTickers.sort((a, b) => b.count - a.count);

        return {
          ...prev,
          total_predictions: prev.total_predictions + 1,
          active_predictions: prev.active_predictions + 1,
          most_predicted_tickers: updatedTickers.slice(0, 5),
        };
      });
    },
  });

  // Realtime: when a prediction is resolved (updated), adjust counts
  useRealtimeSubscription({
    table: 'predictions',
    event: 'UPDATE',
    onEvent: (payload) => {
      const updated = payload.new as Record<string, unknown>;
      const old = payload.old as Record<string, unknown>;

      // If status changed from 'active' to 'resolved'
      if (old.status === 'active' && updated.status === 'resolved') {
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            active_predictions: Math.max(0, prev.active_predictions - 1),
            total_resolved: prev.total_resolved + 1,
          };
        });
      }
    },
  });

  // Realtime: when a new agent registers, bump agent count
  useRealtimeSubscription({
    table: 'agents',
    event: 'INSERT',
    onEvent: () => {
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total_agents: prev.total_agents + 1,
        };
      });
    },
  });

  if (loading || !stats) {
    return (
      <div className="bg-[#111118] border border-[#1E293B] rounded-lg p-4 sm:p-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="h-12 bg-[#1E293B] rounded"></div>
          <div className="h-12 bg-[#1E293B] rounded"></div>
          <div className="h-12 bg-[#1E293B] rounded"></div>
          <div className="h-12 bg-[#1E293B] rounded"></div>
        </div>
      </div>
    );
  }

  const coveragePercentage = (stats.coverage / 100) * 100;

  return (
    <div className="bg-[#111118] border border-[#1E293B] rounded-lg p-4 sm:p-6 hover:border-[#334155] transition-colors">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Agents Count */}
        <div className="flex flex-col">
          <div className="text-[#64748B] text-xs sm:text-sm mb-1">Agents</div>
          <div className="text-[#F8FAFC] text-2xl sm:text-3xl font-bold font-mono relative">
            <AnimatedNumber value={stats.total_agents} />
          </div>
        </div>

        {/* Active Predictions */}
        <div className="flex flex-col">
          <div className="text-[#64748B] text-xs sm:text-sm mb-1">Active Predictions</div>
          <div className="text-[#F8FAFC] text-2xl sm:text-3xl font-bold font-mono relative">
            <AnimatedNumber value={stats.active_predictions} />
          </div>
        </div>

        {/* Resolved Predictions */}
        <div className="flex flex-col">
          <div className="text-[#64748B] text-xs sm:text-sm mb-1">Resolved Predictions</div>
          <div className="text-[#F8FAFC] text-2xl sm:text-3xl font-bold font-mono relative">
            <AnimatedNumber value={stats.total_resolved} />
          </div>
        </div>

        {/* Coverage with Progress Bar */}
        <div className="flex flex-col">
          <div className="text-[#64748B] text-xs sm:text-sm mb-1">
            Coverage: {stats.coverage}/100
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#1E293B] rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#22C55E] to-[#10B981] h-full transition-all duration-500 ease-out"
                style={{ width: `${coveragePercentage}%` }}
              />
            </div>
            <div className="text-[#F8FAFC] text-lg font-bold font-mono whitespace-nowrap">
              {coveragePercentage.toFixed(0)}%
            </div>
          </div>
          <div className="text-[#64748B] text-xs mt-1">
            S&P 100 stocks with predictions
          </div>
        </div>
      </div>

      {/* Most Predicted Tickers */}
      {stats.most_predicted_tickers.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[#1E293B]">
          <div className="text-[#64748B] text-sm mb-3">Most Predicted</div>
          <div className="flex flex-wrap gap-2">
            {stats.most_predicted_tickers.map(({ ticker, count }) => (
              <a
                key={ticker}
                href={`/consensus/${ticker}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E293B] hover:bg-[#334155] border border-[#334155] rounded-full transition-colors group"
              >
                <span className="text-[#F8FAFC] font-bold font-mono group-hover:text-[#22C55E] transition-colors">
                  {ticker}
                </span>
                <span className="text-[#64748B] font-mono text-sm">
                  ({count})
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
