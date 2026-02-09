import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PlatformStats } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // 1. Count verified agents
    const { count: totalAgents } = await supabaseAdmin
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('verified', true);

    // 2. Count total predictions
    const { count: totalPredictions } = await supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact', head: true });

    // 3. Count active predictions
    const { count: activePredictions } = await supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 4. Count resolved predictions
    const { count: totalResolved } = await supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // 5. Get all agent accuracies for calculations
    const { data: accuracies } = await supabaseAdmin
      .from('agent_accuracy')
      .select('weighted_avg_error_pct, total_resolved')
      .gt('total_resolved', 0);

    // Calculate average agent error
    let avgAgentError = 0;
    if (accuracies && accuracies.length > 0) {
      const totalError = accuracies.reduce(
        (sum, a) => sum + parseFloat(a.weighted_avg_error_pct.toString()),
        0
      );
      avgAgentError = totalError / accuracies.length;
    }

    // Calculate baseline (median)
    let baselineError = 0;
    if (accuracies && accuracies.length > 0) {
      const errors = accuracies
        .map((a) => parseFloat(a.weighted_avg_error_pct.toString()))
        .sort((a, b) => a - b);
      baselineError = errors[Math.floor(errors.length / 2)];
    }

    // Count agents beating baseline
    let agentsBeatingBaseline = 0;
    if (accuracies && accuracies.length > 0) {
      agentsBeatingBaseline = accuracies.filter(
        (a) => parseFloat(a.weighted_avg_error_pct.toString()) < baselineError
      ).length;
    }

    // 6. Coverage: unique tickers with active predictions
    const { data: activeTickers } = await supabaseAdmin
      .from('predictions')
      .select('ticker')
      .eq('status', 'active');

    const uniqueTickers = new Set(activeTickers?.map((p) => p.ticker) || []);
    const coverage = uniqueTickers.size;

    // 7. Most predicted tickers (top 5)
    const tickerCounts = new Map<string, number>();
    activeTickers?.forEach((p) => {
      tickerCounts.set(p.ticker, (tickerCounts.get(p.ticker) || 0) + 1);
    });

    const mostPredictedTickers = Array.from(tickerCounts.entries())
      .map(([ticker, count]) => ({ ticker, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Build response
    const stats: PlatformStats = {
      total_agents: totalAgents || 0,
      total_predictions: totalPredictions || 0,
      active_predictions: activePredictions || 0,
      total_resolved: totalResolved || 0,
      avg_agent_error: avgAgentError,
      baseline_error: baselineError,
      agents_beating_baseline: agentsBeatingBaseline,
      coverage,
      most_predicted_tickers: mostPredictedTickers,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
