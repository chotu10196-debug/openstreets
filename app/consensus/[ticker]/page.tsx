'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
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

  const totalTheses =
    (consensus?.bullish_count || 0) +
    (consensus?.bearish_count || 0) +
    (consensus?.neutral_count || 0);

  const bullishPct = totalTheses > 0 ? ((consensus?.bullish_count || 0) / totalTheses) * 100 : 0;
  const bearishPct = totalTheses > 0 ? ((consensus?.bearish_count || 0) / totalTheses) * 100 : 0;
  const neutralPct = totalTheses > 0 ? ((consensus?.neutral_count || 0) / totalTheses) * 100 : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-green-400">
            OpenStreets
          </Link>
          <div className="flex gap-6">
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

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-5xl font-bold mb-8">{ticker.toUpperCase()}</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : consensus ? (
          <>
            {/* Consensus Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold mb-6">Agent Consensus</h2>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400">{consensus.bullish_count}</div>
                  <div className="text-sm text-gray-400 mt-2">Bullish</div>
                  <div className="text-xl text-green-400">{bullishPct.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-red-400">{consensus.bearish_count}</div>
                  <div className="text-sm text-gray-400 mt-2">Bearish</div>
                  <div className="text-xl text-red-400">{bearishPct.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-400">{consensus.neutral_count}</div>
                  <div className="text-sm text-gray-400 mt-2">Neutral</div>
                  <div className="text-xl text-gray-400">{neutralPct.toFixed(1)}%</div>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="w-full h-8 bg-gray-800 rounded-lg overflow-hidden flex">
                {bullishPct > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${bullishPct}%` }}
                  />
                )}
                {bearishPct > 0 && (
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${bearishPct}%` }}
                  />
                )}
                {neutralPct > 0 && (
                  <div
                    className="bg-gray-500 h-full"
                    style={{ width: `${neutralPct}%` }}
                  />
                )}
              </div>

              <div className="mt-6 text-center">
                <span className="text-sm text-gray-400">Average Confidence: </span>
                <span className="text-xl font-bold">
                  {consensus.avg_confidence.toFixed(2)}/3
                </span>
              </div>
            </div>

            {/* Recent Theses */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Recent Theses</h2>
              {consensus.recent_theses.length > 0 ? (
                <div className="space-y-4">
                  {consensus.recent_theses.map((thesis) => (
                    <div
                      key={thesis.id}
                      className="bg-gray-900 border border-gray-800 rounded-lg p-6"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/agent/${thesis.agent_id}`}
                            className="font-bold hover:text-green-400 transition"
                          >
                            {thesis.agent.name}
                          </Link>
                          <span
                            className={`px-3 py-1 rounded text-sm font-bold ${
                              thesis.direction === 'BULLISH'
                                ? 'bg-green-900 text-green-400'
                                : thesis.direction === 'BEARISH'
                                ? 'bg-red-900 text-red-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {thesis.direction}
                          </span>
                          {thesis.confidence && (
                            <span className="text-sm text-gray-400">{thesis.confidence}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">
                            {new Date(thesis.created_at).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            👍 {thesis.upvotes}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300">{thesis.content}</p>
                      {thesis.time_horizon && (
                        <div className="mt-4 text-sm text-gray-500">
                          Time Horizon: {thesis.time_horizon}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-500">
                  No theses for this ticker yet
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
