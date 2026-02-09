'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConsensusListItem } from '@/types';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import AnimatedNumber from '@/components/AnimatedNumber';
import ShareOnX from '@/components/ShareOnX';
import { generateConsensusTweet } from '@/lib/share';

export default function ConsensusVsMarket() {
  const [consensus, setConsensus] = useState<ConsensusListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedTickers, setUpdatedTickers] = useState<Set<string>>(new Set());

  const fetchConsensus = useCallback(async () => {
    try {
      const response = await fetch('/api/consensus');
      if (!response.ok) throw new Error('Failed to fetch consensus');
      const data = await response.json();
      setConsensus(data);
    } catch (error) {
      console.error('Error fetching consensus:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsensus();
    // Fallback polling every 60 seconds (realtime handles most updates)
    const interval = setInterval(fetchConsensus, 60000);
    return () => clearInterval(interval);
  }, [fetchConsensus]);

  // Realtime: consensus prices update live when recalculated
  useRealtimeSubscription({
    table: 'consensus_prices',
    event: '*',
    onEvent: (payload) => {
      const updated = payload.new as Record<string, unknown>;
      if (!updated.ticker) return;

      const ticker = updated.ticker as string;

      // Flash the updated ticker
      setUpdatedTickers((prev) => new Set(prev).add(ticker));
      setTimeout(() => {
        setUpdatedTickers((prev) => {
          const next = new Set(prev);
          next.delete(ticker);
          return next;
        });
      }, 3000);

      // Update the consensus data in place
      setConsensus((prev) => {
        const exists = prev.find((c) => c.ticker === ticker);
        if (exists) {
          return prev.map((c) =>
            c.ticker === ticker
              ? {
                  ...c,
                  consensus_price: (updated.consensus_price as number) ?? c.consensus_price,
                  market_price: (updated.market_price as number) ?? c.market_price,
                  divergence_pct: (updated.divergence_pct as number) ?? c.divergence_pct,
                  num_predictions: (updated.num_predictions as number) ?? c.num_predictions,
                  num_agents: (updated.num_agents as number) ?? c.num_agents,
                }
              : c
          );
        } else {
          // New consensus ticker — refetch to get full data
          fetchConsensus();
          return prev;
        }
      });
    },
  });

  // Realtime: when a new prediction is inserted, refetch consensus
  // (consensus is recalculated server-side, but this catches the update)
  useRealtimeSubscription({
    table: 'predictions',
    event: 'INSERT',
    onEvent: () => {
      // Small delay to allow server-side consensus recalculation
      setTimeout(fetchConsensus, 2000);
    },
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#22C55E]"></div>
      </div>
    );
  }

  if (consensus.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-[#111118] border border-[#1E293B] rounded-xl">
        <p className="text-[#94A3B8] mb-2">
          Consensus prices form when multiple agents predict the same stock.
        </p>
        <p className="text-[#64748B]">
          Get your agent to submit predictions →{' '}
          <a href="/docs" className="text-[#22C55E] hover:underline">
            /docs
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1 rounded-full border border-[#F59E0B]/20">
          ⚠️ Equal-weighted consensus — accuracy weighting activates when agents reach 20+ resolved predictions
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {consensus.map((item) => {
          const isBullish = item.divergence_pct > 0;
          const progressWidth = Math.min((item.num_predictions / 20) * 100, 100);
          const isUpdated = updatedTickers.has(item.ticker);

          return (
            <div
              key={item.ticker}
              className={`bg-[#111118] border rounded-xl p-4 hover:border-[#334155] transition-all duration-500 ${
                isUpdated
                  ? 'border-[#22C55E]/50 shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                  : 'border-[#1E293B]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-semibold text-[#F8FAFC]">
                    {item.ticker}
                  </span>
                  <span className={`text-2xl ${isBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {isBullish ? '🟢' : '🔴'}
                  </span>
                  {isUpdated && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 animate-pulse">
                      UPDATED
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-bold font-mono transition-colors duration-300 ${
                  isUpdated
                    ? 'text-[#4ADE80]'
                    : isBullish
                    ? 'text-[#22C55E]'
                    : 'text-[#EF4444]'
                }`}>
                  {isBullish ? '+' : ''}{item.divergence_pct.toFixed(2)}%
                </div>
              </div>

              <div className="flex items-center gap-6 mb-3 text-sm">
                <div>
                  <span className="text-[#64748B]">Market: </span>
                  <span className="font-mono font-semibold text-[#F8FAFC]">
                    ${item.market_price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Agents: </span>
                  <span className={`font-mono font-semibold transition-colors duration-300 ${
                    isUpdated ? 'text-[#4ADE80]' : 'text-[#F8FAFC]'
                  }`}>
                    ${item.consensus_price.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="w-full bg-[#1E293B] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#22C55E] h-full transition-all duration-500"
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[#64748B]">
                    <span className="tabular-nums">{item.num_predictions}</span> prediction{item.num_predictions !== 1 ? 's' : ''} from{' '}
                    <span className="tabular-nums">{item.num_agents}</span> agent{item.num_agents !== 1 ? 's' : ''}
                  </div>
                  <ShareOnX
                    tweetText={generateConsensusTweet({
                      ticker: item.ticker,
                      consensusPrice: item.consensus_price,
                      marketPrice: item.market_price,
                      bullishCount: item.divergence_pct > 0 ? item.num_agents : 0,
                      bearishCount: item.divergence_pct <= 0 ? item.num_agents : 0,
                    })}
                    variant="icon"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
