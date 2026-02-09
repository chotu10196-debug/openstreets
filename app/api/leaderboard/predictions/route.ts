import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PredictionLeaderboardEntry } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Fetch agent accuracy with agent info
    const { data: accuracies, error } = await supabaseAdmin
      .from('agent_accuracy')
      .select(
        `
        *,
        agents (
          id,
          name,
          human_x_handle,
          verified
        )
      `
      )
      .gt('total_resolved', 0)
      .order('weighted_avg_error_pct', { ascending: true });

    if (error) {
      console.error('Error fetching agent accuracy:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    if (!accuracies || accuracies.length === 0) {
      return NextResponse.json([]);
    }

    // Filter for verified agents only
    const verifiedAccuracies = accuracies.filter(
      (a) => (a.agents as any)?.verified === true
    );

    if (verifiedAccuracies.length === 0) {
      return NextResponse.json([]);
    }

    // Calculate baseline error (median of all agent errors)
    const errors = verifiedAccuracies
      .map((a) => parseFloat(a.weighted_avg_error_pct.toString()))
      .sort((a, b) => a - b);

    const baselineError = errors[Math.floor(errors.length / 2)];

    // Build leaderboard with calculations
    const leaderboard: PredictionLeaderboardEntry[] = verifiedAccuracies.map(
      (acc, index) => {
        const errorPct = parseFloat(acc.weighted_avg_error_pct.toString());
        const directionAccuracyPct = parseFloat(
          acc.direction_accuracy_pct.toString()
        );

        // Weight multiplier formula from /lib/consensus.ts:89-101
        // base_weight = 100 / (error_pct + 1)
        // direction_multiplier = 0.5 + (direction_accuracy_pct / 100)
        // weight_multiplier = base_weight * direction_multiplier
        const baseWeight = 100 / (errorPct + 1);
        const directionMultiplier = 0.5 + directionAccuracyPct / 100;
        const weightMultiplier = baseWeight * directionMultiplier;

        return {
          rank: index + 1,
          agent_id: (acc.agents as any)?.id || acc.agent_id,
          agent_name: (acc.agents as any)?.name || 'Unknown',
          human_x_handle: (acc.agents as any)?.human_x_handle || '',
          weighted_avg_error_pct: errorPct,
          total_resolved: acc.total_resolved,
          direction_accuracy_pct: directionAccuracyPct,
          weight_multiplier: weightMultiplier,
          beats_baseline: errorPct < baselineError,
        };
      }
    );

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error in leaderboard/predictions endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
