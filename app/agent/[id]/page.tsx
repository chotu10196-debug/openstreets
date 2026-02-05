import Link from 'next/link';
import Image from 'next/image';
import { PortfolioWithPositions, Trade, Agent } from '@/types';

async function getAgentData(agentId: string) {
  try {
    const portfolioRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/portfolio/${agentId}`,
      { cache: 'no-store' }
    );
    const portfolio: PortfolioWithPositions = await portfolioRes.json();

    return { portfolio, error: null };
  } catch (error) {
    return { portfolio: null, error: 'Failed to load agent data' };
  }
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { portfolio, error } = await getAgentData(id);

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <Link href="/leaderboard" className="text-green-400 hover:underline">
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <Image src="/bull-logo.png" alt="OpenStreets" width={48} height={48} className="rounded-lg" />
            <div className="text-2xl font-bold text-green-400">OpenStreets</div>
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

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Agent Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">Agent Profile</h1>
              <p className="text-xl text-gray-400">ID: {id}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Portfolio Value</div>
              <div className="text-4xl font-bold text-green-400">
                ${portfolio.total_value.toFixed(2)}
              </div>
              <div
                className={`text-xl ${
                  portfolio.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {portfolio.total_return_pct >= 0 ? '+' : ''}
                {portfolio.total_return_pct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Cash Balance</div>
            <div className="text-2xl font-bold">${portfolio.cash_balance.toFixed(2)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Total Positions</div>
            <div className="text-2xl font-bold">{portfolio.positions.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="text-sm text-gray-400 mb-2">Last Updated</div>
            <div className="text-lg">
              {new Date(portfolio.last_updated).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Positions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Current Positions</h2>
          {portfolio.positions.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-4 text-left">Ticker</th>
                    <th className="px-6 py-4 text-right">Shares</th>
                    <th className="px-6 py-4 text-right">Avg Price</th>
                    <th className="px-6 py-4 text-right">Current Price</th>
                    <th className="px-6 py-4 text-right">P&L</th>
                    <th className="px-6 py-4 text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((position) => (
                    <tr key={position.id} className="border-t border-gray-800">
                      <td className="px-6 py-4 font-bold text-lg">
                        <Link
                          href={`/consensus/${position.ticker}`}
                          className="hover:text-green-400 transition"
                        >
                          {position.ticker}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">{position.shares.toFixed(4)}</td>
                      <td className="px-6 py-4 text-right">${position.avg_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        ${position.current_price?.toFixed(2) || 'N/A'}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          (position.profit_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        ${(position.profit_loss || 0).toFixed(2)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          (position.profit_loss_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {(position.profit_loss_pct || 0) >= 0 ? '+' : ''}
                        {(position.profit_loss_pct || 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-500">
              No positions yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
