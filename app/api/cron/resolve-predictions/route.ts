import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getHistoricalPrice, updateAgentAccuracy } from '@/lib/predictions';
import {
  calculateConsensusPriceForTicker,
  saveConsensusPrice,
} from '@/lib/consensus';
import { getMarketHoursStatus } from '@/lib/market-hours';
import type { PredictionResolutionResult } from '@/types';

/**
 * Cron job to resolve expired predictions and recalculate agent accuracy
 *
 * Schedule: Daily at 4:30 PM ET (30 minutes after market close)
 *
 * Actions:
 * 1. Find all predictions where NOW() >= submitted_at + horizon_days
 * 2. Fetch actual closing price from Polygon (or snapshots)
 * 3. Calculate prediction error and direction correctness
 * 4. Update prediction status to 'resolved'
 * 5. Recalculate agent accuracy with time decay
 * 6. Recalculate consensus prices (with accuracy weighting if applicable)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET authentication
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Check market hours status
    const marketStatus = getMarketHoursStatus();
    console.log('🕒 Market Status:', {
      isOpen: marketStatus.isMarketOpen,
      isMarketDay: marketStatus.isMarketDay,
      currentTimeET: marketStatus.currentTimeET.toISOString(),
    });

    // If not a market day, skip
    if (!marketStatus.isMarketDay) {
      return NextResponse.json({
        message: 'Not a market day',
        skipped: true,
        marketStatus,
      });
    }

    // Find all expired predictions
    // A prediction is expired if NOW() >= submitted_at + horizon_days
    const { data: expiredPredictions, error: fetchError } =
      await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('status', 'active');

    if (fetchError) {
      console.error('❌ Error fetching predictions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    if (!expiredPredictions || expiredPredictions.length === 0) {
      console.log('📊 No active predictions found');
      return NextResponse.json({
        success: true,
        message: 'No active predictions to resolve',
        predictions_resolved: 0,
        predictions_failed: 0,
        failed_tickers: [],
        agents_updated: 0,
        consensus_recalculated: 0,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Filter for predictions that have reached their resolution date
    const now = new Date();
    const predictionsToResolve = expiredPredictions.filter((pred) => {
      const submittedAt = new Date(pred.submitted_at);
      const resolutionDate = new Date(submittedAt);
      resolutionDate.setDate(resolutionDate.getDate() + pred.horizon_days);
      return now >= resolutionDate;
    });

    console.log(
      `📊 Found ${predictionsToResolve.length} predictions to resolve (out of ${expiredPredictions.length} active)`
    );

    if (predictionsToResolve.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No predictions have reached their resolution date yet',
        predictions_resolved: 0,
        predictions_failed: 0,
        failed_tickers: [],
        agents_updated: 0,
        consensus_recalculated: 0,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Process each expired prediction
    const results = {
      resolved: 0,
      failed: 0,
      failedTickers: [] as string[],
    };

    for (const pred of predictionsToResolve) {
      try {
        // Calculate resolution date
        const submittedAt = new Date(pred.submitted_at);
        const resolutionDate = new Date(submittedAt);
        resolutionDate.setDate(resolutionDate.getDate() + pred.horizon_days);

        console.log(
          `🔍 Resolving prediction ${pred.id} for ${pred.ticker} (submitted: ${pred.submitted_at}, resolution: ${resolutionDate.toISOString()})`
        );

        // Fetch historical price
        const actualPrice = await getHistoricalPrice(
          pred.ticker,
          resolutionDate
        );

        // Calculate prediction error percentage
        const targetPrice = parseFloat(pred.target_price.toString());
        const errorPct = (Math.abs(targetPrice - actualPrice) / actualPrice) * 100;

        // Determine direction correctness
        const marketPriceAtSubmission = parseFloat(
          pred.market_price_at_submission.toString()
        );
        const predictedUp = targetPrice > marketPriceAtSubmission;
        const actualUp = actualPrice > marketPriceAtSubmission;
        const directionCorrect = predictedUp === actualUp;

        // Update prediction with resolution data
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
          console.error(
            `❌ Failed to update prediction ${pred.id}:`,
            updateError
          );
          results.failed++;
          if (!results.failedTickers.includes(pred.ticker)) {
            results.failedTickers.push(pred.ticker);
          }
          continue;
        }

        console.log(
          `✅ Resolved ${pred.ticker}: target=$${targetPrice.toFixed(2)}, actual=$${actualPrice.toFixed(2)}, error=${errorPct.toFixed(2)}%, direction=${directionCorrect ? 'correct' : 'incorrect'}`
        );

        results.resolved++;

        // Small delay to avoid overwhelming the API
        if (predictionsToResolve.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Failed to resolve prediction ${pred.id}:`, error);
        results.failed++;
        if (!results.failedTickers.includes(pred.ticker)) {
          results.failedTickers.push(pred.ticker);
        }
      }
    }

    console.log(
      `📈 Resolution complete: ${results.resolved} resolved, ${results.failed} failed`
    );

    // Get unique affected agents and update their accuracy
    const affectedAgents = [
      ...new Set(predictionsToResolve.map((p) => p.agent_id)),
    ];

    console.log(`🎯 Updating accuracy for ${affectedAgents.length} agents`);

    let agentsUpdated = 0;
    for (const agentId of affectedAgents) {
      try {
        await updateAgentAccuracy(agentId);
        agentsUpdated++;
      } catch (error) {
        console.error(`⚠️ Failed to update accuracy for agent ${agentId}:`, error);
        // Don't fail the entire job if accuracy update fails
      }
    }

    // Recalculate consensus for affected tickers
    const affectedTickers = [
      ...new Set(predictionsToResolve.map((p) => p.ticker)),
    ];

    console.log(
      `💰 Recalculating consensus for ${affectedTickers.length} tickers`
    );

    let consensusRecalculated = 0;
    for (const ticker of affectedTickers) {
      try {
        const consensus = await calculateConsensusPriceForTicker(ticker);
        if (consensus) {
          await saveConsensusPrice(consensus);
          consensusRecalculated++;
        }
      } catch (error) {
        console.error(
          `⚠️ Failed to recalculate consensus for ${ticker}:`,
          error
        );
        // Don't fail the entire job if consensus recalculation fails
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`⏱️ Execution time: ${executionTime}ms`);

    // Return summary response
    const response: PredictionResolutionResult = {
      success: true,
      predictions_resolved: results.resolved,
      predictions_failed: results.failed,
      failed_tickers: results.failedTickers,
      agents_updated: agentsUpdated,
      consensus_recalculated: consensusRecalculated,
      execution_time_ms: executionTime,
      timestamp: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error in resolve-predictions cron:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
