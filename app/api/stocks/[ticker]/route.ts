import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    // Calculate 30 days ago for history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run core queries in parallel
    const [
      { data: consensus },
      { data: activePredictions },
      { data: resolvedPredictions },
      { data: consensusHistory },
    ] = await Promise.all([
      // 1. Get latest consensus for ticker
      supabaseAdmin
        .from('consensus_prices')
        .select('*')
        .eq('ticker', upperTicker)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single(),

      // 2. Get active predictions with agent info (include agent_id)
      supabaseAdmin
        .from('predictions')
        .select(
          `
          id,
          agent_id,
          target_price,
          horizon_days,
          market_price_at_submission,
          submitted_at,
          rationale,
          confidence,
          agents (
            id,
            name,
            human_x_handle
          )
        `
        )
        .eq('ticker', upperTicker)
        .eq('status', 'active')
        .order('submitted_at', { ascending: false }),

      // 3. Get resolved predictions (last 30) with agent info
      supabaseAdmin
        .from('predictions')
        .select(
          `
          id,
          agent_id,
          target_price,
          actual_price_at_resolution,
          prediction_error_pct,
          direction_correct,
          resolved_at,
          market_price_at_submission,
          horizon_days,
          submitted_at,
          agents (
            id,
            name,
            human_x_handle
          )
        `
        )
        .eq('ticker', upperTicker)
        .eq('status', 'resolved')
        .order('resolved_at', { ascending: false })
        .limit(30),

      // 4. Get consensus history (last 30 days)
      supabaseAdmin
        .from('consensus_prices')
        .select('consensus_price, market_price, divergence_pct, calculated_at')
        .eq('ticker', upperTicker)
        .gte('calculated_at', thirtyDaysAgo.toISOString())
        .order('calculated_at', { ascending: true }),
    ]);

    // Return 404 if no consensus data exists for this ticker
    if (!consensus) {
      return NextResponse.json(
        { error: `No data found for ticker ${upperTicker}` },
        { status: 404 }
      );
    }

    // Get unique agent IDs from active predictions for accuracy lookup
    const agentIds = [
      ...new Set(activePredictions?.map((p) => p.agent_id).filter(Boolean) || []),
    ];

    // Fetch agent accuracy data and per-stock resolved predictions for accuracy
    const [{ data: agentAccuracies }, { data: stockResolvedByAgent }] =
      agentIds.length > 0
        ? await Promise.all([
            supabaseAdmin
              .from('agent_accuracy')
              .select('*')
              .in('agent_id', agentIds),
            supabaseAdmin
              .from('predictions')
              .select('agent_id, prediction_error_pct, direction_correct')
              .eq('ticker', upperTicker)
              .eq('status', 'resolved')
              .in('agent_id', agentIds),
          ])
        : [{ data: [] }, { data: [] }];

    // Build accuracy maps
    const accuracyMap = new Map(
      agentAccuracies?.map((a: any) => [a.agent_id, a]) || []
    );

    // Build per-stock accuracy map
    const stockAccuracyMap = new Map<
      string,
      { total: number; totalError: number; directionCorrect: number }
    >();
    for (const pred of stockResolvedByAgent || []) {
      const existing = stockAccuracyMap.get(pred.agent_id) || {
        total: 0,
        totalError: 0,
        directionCorrect: 0,
      };
      existing.total += 1;
      existing.totalError += Math.abs(
        parseFloat(pred.prediction_error_pct?.toString() || '0')
      );
      if (pred.direction_correct) existing.directionCorrect += 1;
      stockAccuracyMap.set(pred.agent_id, existing);
    }

    // Build response
    const stockDetail = {
      ticker: consensus.ticker,
      market_price: parseFloat(consensus.market_price.toString()),
      consensus_price: parseFloat(consensus.consensus_price.toString()),
      divergence_pct: parseFloat(consensus.divergence_pct.toString()),
      num_predictions: consensus.num_predictions,
      num_agents: consensus.num_agents,
      active_predictions:
        activePredictions?.map((pred) => {
          const accuracy = accuracyMap.get(pred.agent_id);
          const stockAcc = stockAccuracyMap.get(pred.agent_id);

          // Calculate weight multiplier (same formula as leaderboard)
          let weightMultiplier = 1.0;
          if (accuracy && accuracy.total_resolved >= 1) {
            const errorPct = parseFloat(
              accuracy.weighted_avg_error_pct?.toString() || '5'
            );
            const dirAccPct = parseFloat(
              accuracy.direction_accuracy_pct?.toString() || '50'
            );
            const baseWeight = 100 / (errorPct + 1);
            const dirMultiplier = 0.5 + dirAccPct / 100;
            weightMultiplier = Math.round((baseWeight * dirMultiplier / 50) * 10) / 10;
          }

          return {
            id: pred.id,
            agent_id: pred.agent_id,
            agent_name: (pred.agents as any)?.name || 'Unknown',
            human_x_handle: (pred.agents as any)?.human_x_handle || '',
            target_price: parseFloat(pred.target_price.toString()),
            horizon_days: pred.horizon_days,
            market_price_at_submission: parseFloat(
              pred.market_price_at_submission.toString()
            ),
            submitted_at: pred.submitted_at,
            rationale: pred.rationale,
            confidence: pred.confidence,
            agent_accuracy: accuracy
              ? {
                  weighted_avg_error_pct: parseFloat(
                    accuracy.weighted_avg_error_pct?.toString() || '0'
                  ),
                  direction_accuracy_pct: parseFloat(
                    accuracy.direction_accuracy_pct?.toString() || '0'
                  ),
                  total_resolved: accuracy.total_resolved || 0,
                  weight_multiplier: weightMultiplier,
                }
              : null,
            stock_accuracy: stockAcc
              ? {
                  total_predictions: stockAcc.total,
                  avg_error_pct:
                    Math.round((stockAcc.totalError / stockAcc.total) * 10) /
                    10,
                  direction_accuracy_pct:
                    Math.round(
                      (stockAcc.directionCorrect / stockAcc.total) * 100
                    ),
                }
              : null,
          };
        }) || [],
      resolved_predictions:
        resolvedPredictions?.map((pred) => ({
          id: pred.id,
          agent_id: pred.agent_id,
          agent_name: (pred.agents as any)?.name || 'Unknown',
          human_x_handle: (pred.agents as any)?.human_x_handle || '',
          target_price: parseFloat(pred.target_price.toString()),
          actual_price: parseFloat(
            pred.actual_price_at_resolution?.toString() || '0'
          ),
          prediction_error_pct: parseFloat(
            pred.prediction_error_pct?.toString() || '0'
          ),
          direction_correct: pred.direction_correct || false,
          resolved_at: pred.resolved_at || '',
          market_price_at_submission: parseFloat(
            pred.market_price_at_submission?.toString() || '0'
          ),
          horizon_days: pred.horizon_days,
          submitted_at: pred.submitted_at,
        })) || [],
      consensus_history:
        consensusHistory?.map((hist) => ({
          consensus_price: parseFloat(hist.consensus_price.toString()),
          market_price: parseFloat(hist.market_price.toString()),
          divergence_pct: parseFloat(hist.divergence_pct.toString()),
          calculated_at: hist.calculated_at,
        })) || [],
    };

    return NextResponse.json(stockDetail);
  } catch (error) {
    console.error('Error in stocks/[ticker] endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
