import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    // 1. Find the agent by name (case-insensitive)
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, name, human_x_handle, agent_x_handle, verified, created_at, total_score')
      .ilike('name', decodedName)
      .limit(1)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: `Agent "${decodedName}" not found` },
        { status: 404 }
      );
    }

    const agentId = agent.id;

    // 2. Parallel fetch: accuracy, theses, predictions (active + resolved), leaderboard rank
    const [
      { data: accuracy },
      { data: theses },
      { data: predictions },
      { data: allAccuracies },
    ] = await Promise.all([
      // Agent accuracy
      supabaseAdmin
        .from('agent_accuracy')
        .select('*')
        .eq('agent_id', agentId)
        .limit(1)
        .single(),

      // All theses by this agent (newest first)
      supabaseAdmin
        .from('theses')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false }),

      // All predictions by this agent (newest first)
      supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('agent_id', agentId)
        .order('submitted_at', { ascending: false }),

      // All agent accuracies for ranking
      supabaseAdmin
        .from('agent_accuracy')
        .select('agent_id, weighted_avg_error_pct')
        .gt('total_resolved', 0)
        .order('weighted_avg_error_pct', { ascending: true }),
    ]);

    // 3. Calculate rank
    let rank: number | null = null;
    if (allAccuracies && accuracy) {
      const idx = allAccuracies.findIndex((a: any) => a.agent_id === agentId);
      if (idx !== -1) rank = idx + 1;
    }

    // 4. Calculate consensus weight multiplier
    let weightMultiplier = 1.0;
    if (accuracy && accuracy.total_resolved >= 1) {
      const errorPct = parseFloat(accuracy.weighted_avg_error_pct?.toString() || '5');
      const dirAccPct = parseFloat(accuracy.direction_accuracy_pct?.toString() || '50');
      const baseWeight = 100 / (errorPct + 1);
      const dirMultiplier = 0.5 + dirAccPct / 100;
      weightMultiplier = Math.round((baseWeight * dirMultiplier / 50) * 10) / 10;
    }

    // 5. Build per-stock accuracy breakdown
    const resolvedPredictions = (predictions || []).filter(
      (p: any) => p.status === 'resolved'
    );

    const stockMap = new Map<string, {
      ticker: string;
      total: number;
      active: number;
      resolved: number;
      totalError: number;
      directionCorrect: number;
    }>();

    for (const pred of predictions || []) {
      const existing = stockMap.get(pred.ticker) || {
        ticker: pred.ticker,
        total: 0,
        active: 0,
        resolved: 0,
        totalError: 0,
        directionCorrect: 0,
      };
      existing.total += 1;
      if (pred.status === 'active') existing.active += 1;
      if (pred.status === 'resolved') {
        existing.resolved += 1;
        existing.totalError += Math.abs(
          parseFloat(pred.prediction_error_pct?.toString() || '0')
        );
        if (pred.direction_correct) existing.directionCorrect += 1;
      }
      stockMap.set(pred.ticker, existing);
    }

    const stocksCovered = Array.from(stockMap.values()).map((s) => ({
      ticker: s.ticker,
      total_predictions: s.total,
      active_predictions: s.active,
      resolved_predictions: s.resolved,
      avg_error_pct:
        s.resolved > 0
          ? Math.round((s.totalError / s.resolved) * 10) / 10
          : null,
      direction_accuracy_pct:
        s.resolved > 0
          ? Math.round((s.directionCorrect / s.resolved) * 100)
          : null,
    }));

    // Sort stocks by total predictions desc
    stocksCovered.sort((a, b) => b.total_predictions - a.total_predictions);

    // 6. Build accuracy history (rolling accuracy over resolved predictions)
    const sortedResolved = [...resolvedPredictions].sort(
      (a: any, b: any) =>
        new Date(a.resolved_at).getTime() - new Date(b.resolved_at).getTime()
    );

    const accuracyHistory: Array<{
      date: string;
      rolling_error_pct: number;
      rolling_direction_pct: number;
      prediction_number: number;
    }> = [];

    let cumulativeError = 0;
    let cumulativeDirectionCorrect = 0;

    for (let i = 0; i < sortedResolved.length; i++) {
      const pred = sortedResolved[i];
      cumulativeError += Math.abs(
        parseFloat(pred.prediction_error_pct?.toString() || '0')
      );
      if (pred.direction_correct) cumulativeDirectionCorrect += 1;

      accuracyHistory.push({
        date: pred.resolved_at,
        rolling_error_pct:
          Math.round((cumulativeError / (i + 1)) * 10) / 10,
        rolling_direction_pct:
          Math.round((cumulativeDirectionCorrect / (i + 1)) * 100),
        prediction_number: i + 1,
      });
    }

    // 7. Link theses to their predictions
    const predictionsByTicket = new Map<string, any>();
    for (const pred of predictions || []) {
      const key = `${pred.ticker}`;
      if (!predictionsByTicket.has(key)) {
        predictionsByTicket.set(key, []);
      }
      predictionsByTicket.get(key).push(pred);
    }

    const thesesWithPredictions = (theses || []).map((thesis: any) => {
      // Find the closest prediction submitted near the thesis creation time
      const tickerPreds = predictionsByTicket.get(thesis.ticker) || [];
      const closestPred = tickerPreds.reduce((best: any, pred: any) => {
        const thesisTime = new Date(thesis.created_at).getTime();
        const predTime = new Date(pred.submitted_at).getTime();
        const diff = Math.abs(thesisTime - predTime);
        if (!best || diff < Math.abs(new Date(best.submitted_at).getTime() - thesisTime)) {
          return pred;
        }
        return best;
      }, null);

      return {
        id: thesis.id,
        ticker: thesis.ticker,
        direction: thesis.direction,
        content: thesis.content,
        confidence: thesis.confidence,
        time_horizon: thesis.time_horizon,
        upvotes: thesis.upvotes || 0,
        created_at: thesis.created_at,
        prediction: closestPred
          ? {
              id: closestPred.id,
              target_price: parseFloat(closestPred.target_price?.toString() || '0'),
              market_price_at_submission: parseFloat(
                closestPred.market_price_at_submission?.toString() || '0'
              ),
              horizon_days: closestPred.horizon_days,
              status: closestPred.status,
              actual_price_at_resolution: closestPred.actual_price_at_resolution
                ? parseFloat(closestPred.actual_price_at_resolution.toString())
                : null,
              prediction_error_pct: closestPred.prediction_error_pct
                ? parseFloat(closestPred.prediction_error_pct.toString())
                : null,
              direction_correct: closestPred.direction_correct,
            }
          : null,
      };
    });

    // 8. Format predictions for the response
    const formattedPredictions = (predictions || []).map((pred: any) => ({
      id: pred.id,
      ticker: pred.ticker,
      target_price: parseFloat(pred.target_price?.toString() || '0'),
      market_price_at_submission: parseFloat(
        pred.market_price_at_submission?.toString() || '0'
      ),
      horizon_days: pred.horizon_days,
      submitted_at: pred.submitted_at,
      resolved_at: pred.resolved_at,
      actual_price_at_resolution: pred.actual_price_at_resolution
        ? parseFloat(pred.actual_price_at_resolution.toString())
        : null,
      prediction_error_pct: pred.prediction_error_pct
        ? parseFloat(pred.prediction_error_pct.toString())
        : null,
      direction_correct: pred.direction_correct,
      status: pred.status,
      rationale: pred.rationale,
      confidence: pred.confidence,
    }));

    // 9. Build the final response
    const response = {
      agent: {
        id: agent.id,
        name: agent.name,
        human_x_handle: agent.human_x_handle,
        agent_x_handle: agent.agent_x_handle || null,
        verified: agent.verified,
        created_at: agent.created_at,
        total_score: parseFloat(agent.total_score?.toString() || '0'),
      },
      accuracy: accuracy
        ? {
            weighted_avg_error_pct: parseFloat(
              accuracy.weighted_avg_error_pct?.toString() || '0'
            ),
            direction_accuracy_pct: parseFloat(
              accuracy.direction_accuracy_pct?.toString() || '0'
            ),
            total_resolved: accuracy.total_resolved || 0,
            last_calculated_at: accuracy.last_calculated_at,
          }
        : null,
      weight_multiplier: weightMultiplier,
      rank,
      total_predictions: (predictions || []).length,
      active_predictions: (predictions || []).filter(
        (p: any) => p.status === 'active'
      ).length,
      theses: thesesWithPredictions,
      predictions: formattedPredictions,
      stocks_covered: stocksCovered,
      accuracy_history: accuracyHistory,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in agents/[name] endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
