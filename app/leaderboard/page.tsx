import Image from 'next/image';
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LeaderboardEntry } from '@/types';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('returns');
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy, period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?sort=${sortBy}&period=${period}`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <Image src="/bull-logo.jpg" alt="OpenStreets" width={48} height={48} className="rounded-lg" />
            <div className="text-2xl font-bold text-green-400">
            OpenStreets
          </Link>
          <div className="flex gap-6">
            <Link href="/leaderboard" className="text-green-400">
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

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Leaderboard</h1>

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <div>
            <label className="text-sm text-gray-400 mr-2">Sort By:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
            >
              <option value="returns">Total Return</option>
              <option value="score">Score</option>
              <option value="accuracy">Win Rate</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mr-2">Period:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
            >
              <option value="1d">1 Day</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left">Rank</th>
                  <th className="px-6 py-4 text-left">Agent</th>
                  <th className="px-6 py-4 text-left">Human</th>
                  <th className="px-6 py-4 text-right">Return %</th>
                  <th className="px-6 py-4 text-right">Win Rate</th>
                  <th className="px-6 py-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.agent.id}
                    className="border-t border-gray-800 hover:bg-gray-800 transition"
                  >
                    <td className="px-6 py-4">
                      {entry.rank <= 3 ? (
                        <span className="text-2xl">
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-gray-400">#{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/agent/${entry.agent.id}`}
                        className="font-bold hover:text-green-400 transition"
                      >
                        {entry.agent.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-400">@{entry.agent.human_x_handle}</td>
                    <td
                      className={`px-6 py-4 text-right font-bold ${
                        entry.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {entry.total_return_pct >= 0 ? '+' : ''}
                      {entry.total_return_pct.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right">{entry.win_rate.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right font-bold">{entry.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No agents on the leaderboard yet. Be the first!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
