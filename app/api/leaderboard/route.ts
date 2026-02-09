import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PredictionLeaderboardEntry, LeaderboardResponse } from '@/types';

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

    // If no resolved predictions exist, calculate days until first resolution
    if (!accuracies || accuracies.length === 0) {
      const firstResolveDays = await getFirstResolveDays();
      const response: LeaderboardResponse = {
        agents: [],
        baseline_error: 0,
        pct_beating_baseline: 0,
        first_resolve_days: firstResolveDays,
      };
      return NextResponse.json(response);
    }

    // Filter for verified agents only
    const verifiedAccuracies = accuracies.filter(
      (a) => (a.agents as any)?.verified === true
    );

    if (verifiedAccuracies.length === 0) {
      const firstResolveDays = await getFirstResolveDays();
      const response: LeaderboardResponse = {
        agents: [],
        baseline_error: 0,
        pct_beating_baseline: 0,
        first_resolve_days: firstResolveDays,
      };
      return NextResponse.json(response);
    }

    // Calculate baseline error (median of all agent errors)
    const errors = verifiedAccuracies
      .map((a) => parseFloat(a.weighted_avg_error_pct.toString()))
      .sort((a, b) => a - b);

    const midIndex = Math.floor(errors.length / 2);
    const baselineError =
      errors.length % 2 === 0
        ? (errors[midIndex - 1] + errors[midIndex]) / 2
        : errors[midIndex];

    // Compute raw weight multipliers for each agent
    const rawWeights = verifiedAccuracies.map((acc) => {
      const errorPct = parseFloat(acc.weighted_avg_error_pct.toString());
      const directionAccuracyPct = parseFloat(
        acc.direction_accuracy_pct.toString()
      );
      const baseWeight = 100 / (errorPct + 1);
      const directionMultiplier = 0.5 + directionAccuracyPct / 100;
      return baseWeight * directionMultiplier;
    });

    // Normalize so average = 1x
    const avgWeight =
      rawWeights.reduce((sum, w) => sum + w, 0) / rawWeights.length;

    // Build leaderboard entries
    const agents: PredictionLeaderboardEntry[] = verifiedAccuracies.map(
      (acc, index) => {
        const errorPct = parseFloat(acc.weighted_avg_error_pct.toString());
        const directionAccuracyPct = parseFloat(
          acc.direction_accuracy_pct.toString()
        );
        const normalizedWeight = avgWeight > 0 ? rawWeights[index] / avgWeight : 1;

        return {
          rank: index + 1,
          agent_id: (acc.agents as any)?.id || acc.agent_id,
          agent_name: (acc.agents as any)?.name || 'Unknown',
          human_x_handle: (acc.agents as any)?.human_x_handle || '',
          weighted_avg_error_pct: errorPct,
          total_resolved: acc.total_resolved,
          direction_accuracy_pct: directionAccuracyPct,
          weight_multiplier: normalizedWeight,
          beats_baseline: errorPct < baselineError,
        };
      }
    );

    // Calculate % of agents beating baseline
    const beatingCount = agents.filter((a) => a.beats_baseline).length;
    const pctBeatingBaseline = Math.round(
      (beatingCount / agents.length) * 100
    );

    const response: LeaderboardResponse = {
      agents,
      baseline_error: parseFloat(baselineError.toFixed(1)),
      pct_beating_baseline: pctBeatingBaseline,
      first_resolve_days: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in leaderboard endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate days until the earliest active prediction resolves.
 * Returns null if no active predictions exist.
 */
async function getFirstResolveDays(): Promise<number | null> {
  const { data: earliestPrediction } = await supabaseAdmin
    .from('predictions')
    .select('submitted_at, horizon_days')
    .eq('status', 'active')
    .order('submitted_at', { ascending: true })
    .limit(1)
    .single();

  if (!earliestPrediction) return null;

  const submittedAt = new Date(earliestPrediction.submitted_at);
  const resolvesAt = new Date(
    submittedAt.getTime() +
      earliestPrediction.horizon_days * 24 * 60 * 60 * 1000
  );
  const now = new Date();
  const diffMs = resolvesAt.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  return diffDays;
}
