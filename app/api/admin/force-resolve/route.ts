import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentPrice } from '@/lib/polygon';
import { updateAgentAccuracy } from '@/lib/predictions';
import {
  calculateConsensusPriceForTicker,
  saveConsensusPrice,
} from '@/lib/consensus';

/**
 * Admin endpoint to force-resolve active predictions for a given ticker
 * using today's live market price, bypassing the horizon date check.
 *
 * FOR DEVELOPMENT / TESTING USE ONLY.
 * This endpoint is blocked in production.
 *
 * Usage:
 *   POST /api/admin/force-resolve
 *   Body: { "ticker": "NVDA" }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  const startTime = Date.now();

  let ticker: string;
  try {
    const body = await request.json();
    ticker = (body.ticker as string)?.trim().toUpperCase();
    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Find all active predictions for this ticker
  const { data: activePredictions, error: fetchError } = await supabaseAdmin
    .from('predictions')
    .select('*')
    .eq('ticker', ticker)
    .eq('status', 'active');

  if (fetchError) {
    return NextResponse.json(
      { error: 'Failed to fetch predictions', details: fetchError.message },
      { status: 500 }
    );
  }

  if (!activePredictions || activePredictions.length === 0) {
    return NextResponse.json(
      { error: `No active predictions found for ticker: ${ticker}` },
      { status: 404 }
    );
  }

  // Fetch today's live market price
  let actualPrice: number;
  try {
    actualPrice = await getCurrentPrice(ticker);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch current market price for ${ticker}`,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  const now = new Date();
  const results = {
    resolved: [] as Array<{
      id: string;
      agent_id: string;
      target_price: number;
      actual_price: number;
      error_pct: number;
      direction_correct: boolean;
    }>,
    failed: [] as string[],
  };

  // Resolve each active prediction
  for (const pred of activePredictions) {
    try {
      const targetPrice = parseFloat(pred.target_price.toString());
      const marketPriceAtSubmission = parseFloat(
        pred.market_price_at_submission.toString()
      );

      const errorPct =
        (Math.abs(targetPrice - actualPrice) / actualPrice) * 100;
      const predictedUp = targetPrice > marketPriceAtSubmission;
      const actualUp = actualPrice > marketPriceAtSubmission;
      const directionCorrect = predictedUp === actualUp;

      const { error: updateError } = await supabaseAdmin
        .from('predictions')
        .update({
          status: 'resolved',
          resolved_at: now.toISOString(),
          actual_price_at_resolution: actualPrice,
          prediction_error_pct: errorPct,
          direction_correct: directionCorrect,
        })
        .eq('id', pred.id);

      if (updateError) {
        console.error(`Failed to update prediction ${pred.id}:`, updateError);
        results.failed.push(pred.id);
        continue;
      }

      results.resolved.push({
        id: pred.id,
        agent_id: pred.agent_id,
        target_price: targetPrice,
        actual_price: actualPrice,
        error_pct: parseFloat(errorPct.toFixed(4)),
        direction_correct: directionCorrect,
      });
    } catch (err) {
      console.error(`Failed to resolve prediction ${pred.id}:`, err);
      results.failed.push(pred.id);
    }
  }

  // Update accuracy for all affected agents
  const affectedAgentIds = [
    ...new Set(results.resolved.map((r) => r.agent_id)),
  ];
  const agentsUpdated: string[] = [];

  for (const agentId of affectedAgentIds) {
    try {
      await updateAgentAccuracy(agentId);
      agentsUpdated.push(agentId);
    } catch (err) {
      console.error(`Failed to update accuracy for agent ${agentId}:`, err);
    }
  }

  // Recalculate consensus for the ticker
  let consensusUpdated = false;
  try {
    const consensus = await calculateConsensusPriceForTicker(ticker);
    if (consensus) {
      await saveConsensusPrice(consensus);
      consensusUpdated = true;
    }
  } catch (err) {
    console.error(`Failed to recalculate consensus for ${ticker}:`, err);
  }

  return NextResponse.json({
    success: true,
    ticker,
    actual_price_used: actualPrice,
    predictions_resolved: results.resolved.length,
    predictions_failed: results.failed.length,
    agents_updated: agentsUpdated.length,
    consensus_updated: consensusUpdated,
    resolved: results.resolved,
    failed_ids: results.failed,
    execution_time_ms: Date.now() - startTime,
    timestamp: now.toISOString(),
  });
}
