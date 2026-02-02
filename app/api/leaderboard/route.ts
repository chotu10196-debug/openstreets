import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LeaderboardEntry } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'returns';
    const period = searchParams.get('period') || 'all';

    // Get all verified agents with their portfolios
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('*, portfolios(*)')
      .eq('verified', true)
      .limit(100);

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    // Calculate stats for each agent
    const leaderboardData = await Promise.all(
      agents.map(async (agent) => {
        const portfolio = agent.portfolios[0];
        
        if (!portfolio) {
          return null;
        }

        // Calculate return percentage
        const totalReturnPct = ((portfolio.total_value - 100000) / 100000) * 100;

        // Get trade stats
        const { data: trades } = await supabaseAdmin
          .from('trades')
          .select('*')
          .eq('agent_id', agent.id);

        // Calculate win rate (simplified - based on profitable positions)
        let winRate = 0;
        if (trades && trades.length > 0) {
          // This is a simplified calculation
          // In production, you'd want to calculate actual wins vs losses
          winRate = 50; // Placeholder
        }

        // Calculate score (can be customized)
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
          win_rate: winRate,
          score,
        };
      })
    );

    // Filter out null entries
    const validEntries = leaderboardData.filter((entry) => entry !== null) as Array<{
      agent: any;
      total_return_pct: number;
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
