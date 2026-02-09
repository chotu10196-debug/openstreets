import { supabaseAdmin } from './supabase-admin';
import { getCachedMarketPrice } from './market-price';

export interface ConsensusData {
  ticker: string;
  consensus_price: number;
  market_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
  weighting_method: 'equal' | 'accuracy';
  calculated_at: string;
}

/**
 * Calculate consensus price for a ticker based on active predictions
 * Algorithm:
 * - If ≥50% of agents have 20+ resolved predictions: accuracy-weighted average
 * - Otherwise: simple equal-weighted average
 *
 * Accuracy weighting formula:
 * - base_weight = 100 / (error_pct + 1)
 * - direction_multiplier = 0.5 + (direction_accuracy / 100)
 * - weight = base_weight * direction_multiplier
 *
 * @param ticker - Stock ticker symbol
 * @param horizonDays - Optional: filter by horizon (7 or 14 days)
 * @returns Consensus data or null if no active predictions
 */
export async function calculateConsensusPriceForTicker(
  ticker: string,
  horizonDays?: number
): Promise<ConsensusData | null> {
  const upperTicker = ticker.toUpperCase();

  // Build query for active predictions
  let query = supabaseAdmin
    .from('predictions')
    .select('agent_id, target_price, market_price_at_submission')
    .eq('ticker', upperTicker)
    .eq('status', 'active');

  if (horizonDays) {
    query = query.eq('horizon_days', horizonDays);
  }

  const { data: predictions, error } = await query;

  if (error || !predictions || predictions.length === 0) {
    console.log(`No active predictions found for ${upperTicker}`);
    return null;
  }

  // Get unique agent count
  const uniqueAgents = new Set(predictions.map((p) => p.agent_id));

  // Fetch agent accuracies for all agents with predictions
  const agentIds = Array.from(uniqueAgents);
  const { data: accuracies } = await supabaseAdmin
    .from('agent_accuracy')
    .select('*')
    .in('agent_id', agentIds);

  // Create accuracy map
  const accuracyMap = new Map(
    accuracies?.map((a) => [a.agent_id, a]) || []
  );

  // Check if we should use accuracy weighting
  // Rule: Use accuracy weighting if ≥50% of agents have 20+ resolved predictions
  const qualifiedAgents = Array.from(accuracyMap.values()).filter(
    (a) => a.total_resolved >= 20
  );
  const useAccuracyWeighting =
    qualifiedAgents.length >= predictions.length * 0.5;

  let consensusPrice: number;
  let weightingMethod: 'equal' | 'accuracy';

  if (useAccuracyWeighting) {
    // Accuracy-weighted average
    let weightedSum = 0;
    let totalWeight = 0;

    for (const pred of predictions) {
      const accuracy = accuracyMap.get(pred.agent_id);
      let weight = 1.0; // Default weight for agents without accuracy data

      if (accuracy && accuracy.total_resolved >= 20) {
        // Calculate base weight from error percentage
        // Lower error = higher weight
        const baseWeight =
          100 / (parseFloat(accuracy.weighted_avg_error_pct.toString()) + 1);

        // Apply direction accuracy multiplier (0.5x to 1.5x)
        // 50% direction accuracy → 0.5x, 100% direction accuracy → 1.5x
        const directionMultiplier =
          0.5 +
          parseFloat(accuracy.direction_accuracy_pct.toString()) / 100;

        weight = baseWeight * directionMultiplier;
      }

      const targetPrice = parseFloat(pred.target_price.toString());
      weightedSum += targetPrice * weight;
      totalWeight += weight;
    }

    consensusPrice = weightedSum / totalWeight;
    weightingMethod = 'accuracy';

    console.log(
      `📊 Using accuracy-weighted consensus for ${upperTicker} (${qualifiedAgents.length}/${predictions.length} qualified agents)`
    );
  } else {
    // Simple average (equal weighting)
    const totalTargetPrice = predictions.reduce(
      (sum, pred) => sum + parseFloat(pred.target_price.toString()),
      0
    );
    consensusPrice = totalTargetPrice / predictions.length;
    weightingMethod = 'equal';

    console.log(
      `📊 Using equal-weighted consensus for ${upperTicker} (${qualifiedAgents.length}/${predictions.length} qualified agents)`
    );
  }

  // Use the most recent market price from predictions
  const marketPrice = parseFloat(
    predictions[0].market_price_at_submission.toString()
  );

  // Calculate divergence percentage
  const divergencePct = ((consensusPrice - marketPrice) / marketPrice) * 100;

  return {
    ticker: upperTicker,
    consensus_price: consensusPrice,
    market_price: marketPrice,
    divergence_pct: divergencePct,
    num_predictions: predictions.length,
    num_agents: uniqueAgents.size,
    weighting_method: weightingMethod,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Update or insert consensus price in database
 * Inserts into consensus_prices table
 *
 * @param consensusData - Consensus calculation result
 */
export async function saveConsensusPrice(
  consensusData: ConsensusData
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('consensus_prices')
    .insert({
      ticker: consensusData.ticker,
      consensus_price: consensusData.consensus_price,
      market_price: consensusData.market_price,
      divergence_pct: consensusData.divergence_pct,
      num_predictions: consensusData.num_predictions,
      num_agents: consensusData.num_agents,
      weighting_method: consensusData.weighting_method,
      calculated_at: consensusData.calculated_at,
    });

  if (error) {
    console.error('Error saving consensus price:', error);
    throw error;
  }
}

/**
 * Get the latest consensus price for a ticker from database
 *
 * @param ticker - Stock ticker symbol
 * @returns Latest consensus data or null if not found
 */
export async function getLatestConsensus(
  ticker: string
): Promise<ConsensusData | null> {
  const { data, error } = await supabaseAdmin
    .from('consensus_prices')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ticker: data.ticker,
    consensus_price: parseFloat(data.consensus_price.toString()),
    market_price: parseFloat(data.market_price.toString()),
    divergence_pct: parseFloat(data.divergence_pct.toString()),
    num_predictions: data.num_predictions,
    num_agents: data.num_agents,
    weighting_method: data.weighting_method,
    calculated_at: data.calculated_at,
  };
}

/**
 * Calculate trimmed mean by removing outliers beyond 2 standard deviations from median
 *
 * @param values - Array of numbers
 * @returns Trimmed mean
 */
function calculateTrimmedMean(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  // Sort values to find median
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  // Calculate standard deviation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  // Filter out values beyond 2 standard deviations from median
  const filtered = values.filter(
    (val) => Math.abs(val - median) <= 2 * stdDev
  );

  // If all values filtered out (shouldn't happen), return median
  if (filtered.length === 0) return median;

  // Calculate mean of filtered values
  return filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
}

/**
 * Calculate consensus price using specified algorithm:
 * - Fetches all active predictions for ticker
 * - Determines weighting method based on agent resolved prediction counts
 * - Equal weight: uses trimmed mean (drops outliers beyond 2 std devs from median)
 * - Accuracy weight: weights by 1/error_pct, newer agents get median weight * 0.5
 * - Fetches latest market price
 * - Calculates divergence percentage
 * - Upserts into consensus_prices table
 *
 * @param ticker - Stock ticker symbol
 * @returns Consensus data or null if no active predictions
 */
export async function calculateConsensus(
  ticker: string
): Promise<ConsensusData | null> {
  const upperTicker = ticker.toUpperCase();

  // 1. Fetch all active predictions for this ticker
  const { data: predictions, error } = await supabaseAdmin
    .from('predictions')
    .select('agent_id, target_price')
    .eq('ticker', upperTicker)
    .eq('status', 'active');

  if (error || !predictions || predictions.length === 0) {
    console.log(`No active predictions found for ${upperTicker}`);
    return null;
  }

  // Get unique agent IDs
  const uniqueAgentIds = Array.from(
    new Set(predictions.map((p) => p.agent_id))
  );
  const numAgents = uniqueAgentIds.length;

  // Fetch agent accuracies for all predicting agents
  const { data: accuracies } = await supabaseAdmin
    .from('agent_accuracy')
    .select('*')
    .in('agent_id', uniqueAgentIds);

  // Create accuracy map
  const accuracyMap = new Map(
    accuracies?.map((a) => [a.agent_id, a]) || []
  );

  // 2. Determine weighting method
  // If ALL agents have < 20 resolved predictions → equal weight
  // If SOME agents have 20+ resolved → accuracy weight
  const allAgentsAreNew = uniqueAgentIds.every((agentId) => {
    const accuracy = accuracyMap.get(agentId);
    return !accuracy || accuracy.total_resolved < 20;
  });

  let consensusPrice: number;
  let weightingMethod: 'equal' | 'accuracy';

  if (allAgentsAreNew) {
    // 3. Equal weight with trimmed mean
    const targetPrices = predictions.map((p) =>
      parseFloat(p.target_price.toString())
    );
    consensusPrice = calculateTrimmedMean(targetPrices);
    weightingMethod = 'equal';

    console.log(
      `📊 Using equal-weighted (trimmed mean) consensus for ${upperTicker} (all ${numAgents} agents have < 20 resolved predictions)`
    );
  } else {
    // 4. Accuracy weight
    // Calculate weights for agents with 20+ resolved predictions
    const scoredAgentWeights: number[] = [];
    const weights = new Map<string, number>();

    for (const agentId of uniqueAgentIds) {
      const accuracy = accuracyMap.get(agentId);

      if (accuracy && accuracy.total_resolved >= 20) {
        // weight = 1 / weighted_avg_error_pct
        const errorPct = parseFloat(accuracy.weighted_avg_error_pct.toString());
        const weight = 1 / errorPct;
        weights.set(agentId, weight);
        scoredAgentWeights.push(weight);
      }
    }

    // Calculate median weight for scored agents
    let medianWeight = 0;
    if (scoredAgentWeights.length > 0) {
      const sortedWeights = [...scoredAgentWeights].sort((a, b) => a - b);
      medianWeight =
        sortedWeights.length % 2 === 0
          ? (sortedWeights[sortedWeights.length / 2 - 1] +
              sortedWeights[sortedWeights.length / 2]) /
            2
          : sortedWeights[Math.floor(sortedWeights.length / 2)];
    }

    // Assign median weight * 0.5 to newer agents
    const newerAgentWeight = medianWeight * 0.5;
    for (const agentId of uniqueAgentIds) {
      if (!weights.has(agentId)) {
        weights.set(agentId, newerAgentWeight);
      }
    }

    // Normalize weights to sum to 1
    const totalWeight = Array.from(weights.values()).reduce(
      (sum, w) => sum + w,
      0
    );
    const normalizedWeights = new Map<string, number>();
    for (const [agentId, weight] of weights) {
      normalizedWeights.set(agentId, weight / totalWeight);
    }

    // Calculate weighted consensus
    let weightedSum = 0;
    for (const pred of predictions) {
      const targetPrice = parseFloat(pred.target_price.toString());
      const weight = normalizedWeights.get(pred.agent_id) || 0;
      weightedSum += targetPrice * weight;
    }

    consensusPrice = weightedSum;
    weightingMethod = 'accuracy';

    const numScoredAgents = scoredAgentWeights.length;
    const numNewerAgents = numAgents - numScoredAgents;
    console.log(
      `📊 Using accuracy-weighted consensus for ${upperTicker} (${numScoredAgents} scored agents, ${numNewerAgents} newer agents)`
    );
  }

  // 5. Fetch latest market price
  const { price: marketPrice } = await getCachedMarketPrice(upperTicker);

  // 6. Calculate divergence_pct
  const divergencePct = ((consensusPrice - marketPrice) / marketPrice) * 100;

  // 7. Insert into consensus_prices table
  const consensusData: ConsensusData = {
    ticker: upperTicker,
    consensus_price: consensusPrice,
    market_price: marketPrice,
    divergence_pct: divergencePct,
    num_predictions: predictions.length,
    num_agents: numAgents,
    weighting_method: weightingMethod,
    calculated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabaseAdmin
    .from('consensus_prices')
    .insert({
      ticker: consensusData.ticker,
      consensus_price: consensusData.consensus_price,
      market_price: consensusData.market_price,
      divergence_pct: consensusData.divergence_pct,
      num_predictions: consensusData.num_predictions,
      num_agents: consensusData.num_agents,
      weighting_method: consensusData.weighting_method,
      calculated_at: consensusData.calculated_at,
    });

  if (insertError) {
    console.error('Error inserting consensus price:', insertError);
    throw insertError;
  }

  console.log(
    `✅ Consensus saved for ${upperTicker}: $${consensusPrice.toFixed(2)} (market: $${marketPrice.toFixed(2)}, divergence: ${divergencePct.toFixed(2)}%)`
  );

  // 8. Return consensus data
  return consensusData;
}
