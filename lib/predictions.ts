import { supabaseAdmin } from './supabase-admin';
import { getCurrentPrice } from './polygon';
import { AgentAccuracy } from '@/types';

const DECAY_FACTOR = 0.95; // 5% decay per day

/**
 * Fetches historical price for a ticker at a specific date
 * Strategy:
 * 1. Check market_price_snapshots table first (±30 min of 4:00 PM ET on target date)
 * 2. Fall back to Polygon API if snapshot not found
 * 3. Throw error if both fail (prediction will be retried tomorrow)
 *
 * @param ticker - Stock ticker symbol
 * @param targetDate - Date to fetch price for
 * @returns Historical closing price
 */
export async function getHistoricalPrice(
  ticker: string,
  targetDate: Date
): Promise<number> {
  const upperTicker = ticker.toUpperCase();

  // Step 1: Try market_price_snapshots table
  // Set up time window: 4:00 PM ET ±30 minutes
  const marketCloseTime = new Date(targetDate);
  marketCloseTime.setHours(16, 0, 0, 0); // 4:00 PM

  const windowStart = new Date(marketCloseTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(marketCloseTime.getTime() + 30 * 60 * 1000);

  const { data: snapshot, error: snapshotError } = await supabaseAdmin
    .from('market_price_snapshots')
    .select('price, captured_at')
    .eq('ticker', upperTicker)
    .gte('captured_at', windowStart.toISOString())
    .lte('captured_at', windowEnd.toISOString())
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshot && !snapshotError) {
    console.log(
      `✅ Found snapshot for ${upperTicker} at ${snapshot.captured_at}`
    );
    return parseFloat(snapshot.price.toString());
  }

  // Step 2: Fallback to Polygon API
  console.log(
    `⚠️ No snapshot found for ${upperTicker} on ${targetDate.toISOString()}, fetching from Polygon`
  );

  try {
    const price = await getCurrentPrice(upperTicker);
    return price;
  } catch (error) {
    console.error(`❌ Failed to fetch price for ${upperTicker}:`, error);
    throw new Error(
      `Unable to fetch historical price for ${upperTicker} on ${targetDate.toISOString()}`
    );
  }
}

/**
 * Calculates agent accuracy metrics with exponential time decay
 * Formula:
 * - decay_weight = 0.95^(days_since_resolution)
 * - weighted_avg_error = SUM(error * decay) / SUM(decay)
 * - direction_accuracy = SUM(direction_correct * decay) / SUM(decay) * 100
 *
 * @param agentId - Agent UUID
 * @returns Agent accuracy metrics or null if no resolved predictions
 */
export async function calculateAgentAccuracy(
  agentId: string
): Promise<Omit<AgentAccuracy, 'id'> | null> {
  // Fetch all resolved predictions for this agent
  const { data: predictions, error } = await supabaseAdmin
    .from('predictions')
    .select('prediction_error_pct, direction_correct, resolved_at')
    .eq('agent_id', agentId)
    .eq('status', 'resolved')
    .not('prediction_error_pct', 'is', null)
    .not('direction_correct', 'is', null)
    .order('resolved_at', { ascending: false });

  if (error || !predictions || predictions.length === 0) {
    console.log(`No resolved predictions found for agent ${agentId}`);
    return null;
  }

  const now = Date.now();
  let weightedErrorSum = 0;
  let weightedDecaySum = 0;
  let weightedDirectionCorrectSum = 0;

  for (const pred of predictions) {
    const resolvedAt = new Date(pred.resolved_at!).getTime();
    const daysSinceResolution = (now - resolvedAt) / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(DECAY_FACTOR, daysSinceResolution);

    // Accumulate weighted error
    weightedErrorSum +=
      parseFloat(pred.prediction_error_pct!.toString()) * decayWeight;
    weightedDecaySum += decayWeight;

    // Accumulate weighted direction correctness
    if (pred.direction_correct) {
      weightedDirectionCorrectSum += decayWeight;
    }
  }

  return {
    agent_id: agentId,
    weighted_avg_error_pct: weightedErrorSum / weightedDecaySum,
    direction_accuracy_pct:
      (weightedDirectionCorrectSum / weightedDecaySum) * 100,
    total_resolved: predictions.length,
    last_calculated_at: new Date().toISOString(),
  };
}

/**
 * Updates agent accuracy in the database
 * Upserts into agent_accuracy table (insert if new, update if exists)
 *
 * @param agentId - Agent UUID
 */
export async function updateAgentAccuracy(agentId: string): Promise<void> {
  const accuracy = await calculateAgentAccuracy(agentId);

  if (!accuracy) {
    console.log(`⚠️ No accuracy data to update for agent ${agentId}`);
    return;
  }

  // Upsert into agent_accuracy table
  const { error } = await supabaseAdmin.from('agent_accuracy').upsert(
    {
      agent_id: accuracy.agent_id,
      weighted_avg_error_pct: accuracy.weighted_avg_error_pct,
      direction_accuracy_pct: accuracy.direction_accuracy_pct,
      total_resolved: accuracy.total_resolved,
      last_calculated_at: accuracy.last_calculated_at,
    },
    {
      onConflict: 'agent_id',
    }
  );

  if (error) {
    console.error(`❌ Failed to update accuracy for agent ${agentId}:`, error);
    throw error;
  }

  console.log(
    `✅ Updated accuracy for agent ${agentId}: ${accuracy.weighted_avg_error_pct.toFixed(2)}% error, ${accuracy.direction_accuracy_pct.toFixed(2)}% direction accuracy`
  );
}
