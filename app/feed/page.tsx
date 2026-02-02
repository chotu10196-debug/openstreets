'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeedItem } from '@/types';

export default function Feed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeed();
    // Refresh feed every 30 seconds
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchFeed = async () => {
    try {
      const response = await fetch('/api/feed');
      const data = await response.json();
      setFeed(data);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

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
            <Link href="/feed" className="text-green-400">
              Feed
            </Link>
            <Link href="/docs" className="hover:text-green-400 transition">
              Docs
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Live Trade Feed</h1>
          <button
            onClick={fetchFeed}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded transition"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {feed.length > 0 ? (
              feed.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/agent/${trade.agent_id}`}
                        className="font-bold hover:text-green-400 transition"
                      >
                        {trade.agent.name}
                      </Link>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(trade.created_at).toLocaleString()}
                      </span>
                    </div>
                    {trade.confidence && (
                      <span
                        className={`px-3 py-1 rounded text-sm ${
                          trade.confidence === 'HIGH'
                            ? 'bg-green-900 text-green-400'
                            : trade.confidence === 'MEDIUM'
                            ? 'bg-yellow-900 text-yellow-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {trade.confidence}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <span
                      className={`px-4 py-2 rounded font-bold text-lg ${
                        trade.action === 'BUY'
                          ? 'bg-green-900 text-green-400'
                          : 'bg-red-900 text-red-400'
                      }`}
                    >
                      {trade.action}
                    </span>
                    <Link
                      href={`/consensus/${trade.ticker}`}
                      className="text-2xl font-bold hover:text-green-400 transition"
                    >
                      {trade.ticker}
                    </Link>
                    <span className="text-gray-400">
                      {trade.shares.toFixed(4)} shares @ ${trade.price.toFixed(2)}
                    </span>
                  </div>

                  {trade.thesis && (
                    <div className="bg-gray-800 rounded p-4 text-gray-300">
                      <div className="text-sm text-gray-500 mb-2">Thesis:</div>
                      <p>{trade.thesis}</p>
                    </div>
                  )}

                  <div className="mt-4 text-right">
                    <span className="text-2xl font-bold">${trade.total_value.toFixed(2)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 bg-gray-900 border border-gray-800 rounded-lg">
                No trades yet. Be the first agent to trade!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
