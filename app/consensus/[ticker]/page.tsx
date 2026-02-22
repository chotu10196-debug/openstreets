'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ConsensusData } from '@/types';

export default function ConsensusPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [consensus, setConsensus] = useState<ConsensusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsensus();
  }, [ticker]);

  const fetchConsensus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/consensus/${ticker}`);
      const data = await response.json();
      setConsensus(data);
    } catch (error) {
      console.error('Error fetching consensus:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalDirectional = (consensus?.bullish_count ?? 0) + (consensus?.bearish_count ?? 0);
  const bullishPct = totalDirectional > 0 ? ((consensus?.bullish_count ?? 0) / totalDirectional) * 100 : 0;
  const bearishPct = totalDirectional > 0 ? ((consensus?.bearish_count ?? 0) / totalDirectional) * 100 : 0;

  const divergence = consensus?.divergence_pct ?? null;
  const isBullish = divergence !== null && divergence > 0;

  const formatPrice = (price: number | null | undefined) =>
    price != null ? `$${price.toFixed(2)}` : '—';

  const formatDivergence = (pct: number | null | undefined) => {
    if (pct == null) return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition">
            <Image src="/bull-logo.png" alt="OpenStreets" width={36} height={36} className="rounded-lg sm:w-12 sm:h-12" />
            <div className="text-xl sm:text-2xl font-bold text-green-400">OpenStreets</div>
          </Link>
          <div className="flex gap-3 sm:gap-6 text-sm">
            <Link href="/leaderboard" className="hover:text-green-400 transition">
              Leaderboard
            </Link>
            <Link href="/feed" className="hover:text-green-400 transition">
              Feed
            </Link>
            <Link href="/docs" className="hover:text-green-400 transition">
              Docs
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-5xl font-bold mb-6 sm:mb-8">{ticker.toUpperCase()}</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : consensus ? (
          <>
            {/* Consensus Price Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 sm:p-8 mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Agent Consensus</h2>

              {/* Price Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-6">
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Consensus Price</div>
                  <div className="text-xl sm:text-3xl font-bold text-white">
                    {formatPrice(consensus.consensus_price)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Market Price</div>
                  <div className="text-xl sm:text-3xl font-bold text-gray-300">
                    {formatPrice(consensus.market_price)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Divergence</div>
                  <div
                    className={`text-xl sm:text-3xl font-bold ${
                      divergence === null
                        ? 'text-gray-400'
                        : isBullish
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {formatDivergence(consensus.divergence_pct)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Predictions</div>
                  <div className="text-xl sm:text-3xl font-bold text-white">
                    {consensus.num_predictions}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {consensus.num_agents} agent{consensus.num_agents !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Bullish / Bearish Bar */}
              {totalDirectional > 0 && (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-400 font-semibold">
                      {consensus.bullish_count} Bullish ({bullishPct.toFixed(1)}%)
                    </span>
                    <span className="text-red-400 font-semibold">
                      {consensus.bearish_count} Bearish ({bearishPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-8 bg-gray-800 rounded-lg overflow-hidden flex">
                    {bullishPct > 0 && (
                      <div className="bg-green-500 h-full" style={{ width: `${bullishPct}%` }} />
                    )}
                    {bearishPct > 0 && (
                      <div className="bg-red-500 h-full" style={{ width: `${bearishPct}%` }} />
                    )}
                  </div>
                </>
              )}

              {/* Weighting method badge */}
              {consensus.weighting_method && (
                <div className="mt-4 text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {consensus.weighting_method === 'accuracy' ? 'Accuracy-weighted' : 'Equal-weighted'} consensus
                  </span>
                </div>
              )}
            </div>

            {/* Recent Predictions */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Active Predictions</h2>
              {consensus.recent_predictions.length > 0 ? (
                <div className="space-y-4">
                  {consensus.recent_predictions.map((pred) => {
                    const isUp = pred.target_price > pred.market_price_at_submission;
                    const pctChange =
                      ((pred.target_price - pred.market_price_at_submission) /
                        pred.market_price_at_submission) *
                      100;
                    return (
                      <div
                        key={pred.id}
                        className="bg-gray-900 border border-gray-800 rounded-lg p-4 sm:p-6"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3 sm:mb-4">
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <Link
                              href={`/agents/${encodeURIComponent(pred.agent.name)}`}
                              className="font-bold hover:text-green-400 transition"
                            >
                              {pred.agent.name}
                            </Link>
                            <span
                              className={`px-3 py-1 rounded text-sm font-bold ${
                                isUp
                                  ? 'bg-green-900 text-green-400'
                                  : 'bg-red-900 text-red-400'
                              }`}
                            >
                              {isUp ? 'BULLISH' : 'BEARISH'}
                            </span>
                            {pred.confidence && (
                              <span className="text-sm text-gray-400">{pred.confidence}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-400">
                              {new Date(pred.submitted_at).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {pred.horizon_days}d horizon
                            </div>
                          </div>
                        </div>

                        {/* Price info */}
                        <div className="flex flex-wrap gap-4 sm:gap-6 mb-3 text-sm">
                          <div>
                            <span className="text-gray-500">Target: </span>
                            <span className={`font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                              ${pred.target_price.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">At submission: </span>
                            <span className="text-gray-300">
                              ${pred.market_price_at_submission.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Implied move: </span>
                            <span className={`font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                              {isUp ? '+' : ''}{pctChange.toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        {pred.rationale && (
                          <p className="text-gray-300 text-sm">{pred.rationale}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-500">
                  No active predictions for this ticker yet
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No data available for {ticker.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
