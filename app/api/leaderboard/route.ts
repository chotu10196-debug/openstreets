import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getBatchPrices } from '@/lib/polygon';
import { LeaderboardEntry } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'returns';
    const period = searchParams.get('period') || 'all';

    // Get all verified agents
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('id, name, human_x_handle, agent_x_handle, verified, created_at, total_score')
      .eq('verified', true)
      .limit(100);

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    // Get all tickers to fetch prices in batch
    const { data: allPositions } = await supabaseAdmin
      .from('positions')
      .select('ticker')
      .in('agent_id', agents.map(a => a.id));

    const uniqueTickers = [...new Set(allPositions?.map(p => p.ticker) || [])];
    const prices = uniqueTickers.length > 0 ? await getBatchPrices(uniqueTickers) : new Map();

    // Calculate stats for each agent
    const leaderboardData = await Promise.all(
      agents.map(async (agent) => {
        // Get portfolio
        const { data: portfolio } = await supabaseAdmin
          .from('portfolios')
          .select('cash_balance')
          .eq('agent_id', agent.id)
          .single();
        
        if (!portfolio) {
          return null;
        }

        // Get positions
        const { data: positions } = await supabaseAdmin
          .from('positions')
          .select('ticker, shares, avg_price')
          .eq('agent_id', agent.id);

        // Calculate total position value
        let totalPositionValue = 0;
        if (positions && positions.length > 0) {
          for (const position of positions) {
            const currentPrice = prices.get(position.ticker) || 0;
            const positionValue = parseFloat(position.shares) * currentPrice;
            totalPositionValue += positionValue;
          }
        }

        // Calculate total portfolio value
        const totalValue = portfolio.cash_balance + totalPositionValue;
        const totalReturnPct = ((totalValue - 100000) / 100000) * 100;

        // Get trade stats
        const { data: trades } = await supabaseAdmin
          .from('trades')
          .select('id')
          .eq('agent_id', agent.id);

        // Calculate win rate (placeholder for now)
        let winRate = 0;
        if (trades && trades.length > 0) {
          winRate = 50; // Placeholder - would need to calculate from closed positions
        }

        // Calculate score
        const score = totalReturnPct;

        return {
          agent: {
            id: agent.id,
            name: agent.name,
            human_x_handle: agent.human_x_handle,
            agent_x_handle: agent.agent_x_handle,
            verified: agent.verified,
            created_at: agent.created_at,
            total_score: agent.total_score,
          },
          total_return_pct: totalReturnPct,
          total_value: totalValue,
          win_rate: winRate,
          score,
        };
      })
    );

    // Filter out null entries
    const validEntries = leaderboardData.filter((entry) => entry !== null) as Array<{
      agent: any;
      total_return_pct: number;
      total_value: number;
      win_rate: number;
      score: number;
    }>;

    // Sort based on parameter
    validEntries.sort((a, b) => {
      if (sort === 'returns') {
        return b.total_return_pct - a.total_return_pct;
      } else if (sort === 'score') {
        return b.score - a.score;
      } else if (sort === 'accuracy') {
        return b.win_rate - a.win_rate;
      }
      return 0;
    });

    // Add ranks
    const leaderboard: LeaderboardEntry[] = validEntries.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error in leaderboard endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
