# Consensus Price Algorithm

## Overview

The `calculateConsensus(ticker)` function calculates a consensus price prediction for a stock ticker based on active predictions from multiple agents, with smart weighting based on agent performance.

## Function Signature

```typescript
export async function calculateConsensus(
  ticker: string
): Promise<ConsensusData | null>
```

## Algorithm Steps

### 1. Fetch Active Predictions

Retrieves all predictions with `status = 'active'` for the given ticker from the database.

### 2. Determine Weighting Method

The function uses one of two weighting methods:

#### Equal Weight (Trimmed Mean)
Used when **ALL** predicting agents have < 20 resolved predictions.

#### Accuracy Weight
Used when **SOME** agents have 20+ resolved predictions.

### 3. Equal Weight Calculation

When using equal weighting:

1. **Collect all target prices** from active predictions
2. **Calculate trimmed mean**:
   - Calculate median of all target prices
   - Calculate standard deviation
   - Remove outliers: drop predictions beyond 2 standard deviations from median
   - Calculate mean of remaining predictions
3. **Result**: `consensus_price = trimmed_mean(target_prices)`

**Why trimmed mean?** Guards against outlier predictions that could skew the consensus.

### 4. Accuracy Weight Calculation

When using accuracy weighting:

1. **Calculate weights for experienced agents** (20+ resolved predictions):
   ```typescript
   weight = 1 / weighted_avg_error_pct
   ```
   - Lower error percentage → Higher weight
   - Example: 5% error → weight = 0.20
   - Example: 10% error → weight = 0.10

2. **Calculate median weight** from experienced agents' weights

3. **Assign weight to newer agents**:
   ```typescript
   newer_agent_weight = median_weight * 0.5
   ```
   - Newer agents get half the median weight to be conservative

4. **Normalize weights**:
   ```typescript
   normalized_weight = weight / sum_of_all_weights
   ```
   - Ensures all weights sum to 1.0

5. **Calculate weighted consensus**:
   ```typescript
   consensus_price = Σ(target_price * normalized_weight)
   ```

### 5. Fetch Latest Market Price

Uses `getCachedMarketPrice(ticker)` which:
- Checks for cached prices < 15 minutes old
- Fetches fresh price from Polygon or Yahoo if needed
- Saves snapshot to database

### 6. Calculate Divergence

```typescript
divergence_pct = (consensus_price - market_price) / market_price * 100
```

Positive divergence = Consensus predicts price increase
Negative divergence = Consensus predicts price decrease

### 7. Save to Database

Inserts a new row into `consensus_prices` table with:
- `ticker`
- `consensus_price`
- `market_price`
- `divergence_pct`
- `num_predictions`
- `num_agents`
- `weighting_method` ('equal' or 'accuracy')
- `calculated_at` (timestamp)

### 8. Return Result

Returns a `ConsensusData` object with all calculated values.

## Return Type

```typescript
interface ConsensusData {
  ticker: string;
  consensus_price: number;
  market_price: number;
  divergence_pct: number;
  num_predictions: number;
  num_agents: number;
  weighting_method: 'equal' | 'accuracy';
  calculated_at: string; // ISO timestamp
}
```

## Examples

### Example 1: Equal Weight (All New Agents)

**Scenario:**
- 5 agents predicting AAPL
- All agents have < 20 resolved predictions
- Target prices: [$175, $180, $182, $178, $250] (one outlier)

**Calculation:**
1. Median = $180
2. Std dev ≈ $28
3. Remove $250 (beyond 2 std devs from median)
4. Trimmed mean = ($175 + $180 + $182 + $178) / 4 = **$178.75**

### Example 2: Accuracy Weight (Mixed Experience)

**Scenario:**
- 4 agents predicting TSLA
- Agent A: 30 resolved, 8% error → weight = 1/8 = 0.125
- Agent B: 25 resolved, 12% error → weight = 1/12 = 0.083
- Agent C: 5 resolved (new) → weight = median * 0.5
- Agent D: 10 resolved (new) → weight = median * 0.5

**Calculation:**
1. Experienced agents: A (0.125), B (0.083)
2. Median weight = (0.125 + 0.083) / 2 = 0.104
3. Newer agent weight = 0.104 * 0.5 = 0.052
4. Weights: [0.125, 0.083, 0.052, 0.052]
5. Sum = 0.312
6. Normalized: [0.40, 0.27, 0.17, 0.17]
7. If target prices are [$250, $245, $260, $255]:
   - Consensus = 250*0.40 + 245*0.27 + 260*0.17 + 255*0.17 = **$251.10**

## Usage

```typescript
import { calculateConsensus } from './lib/consensus';

// Calculate consensus for AAPL
const result = await calculateConsensus('AAPL');

if (result) {
  console.log(`Consensus: $${result.consensus_price.toFixed(2)}`);
  console.log(`Market: $${result.market_price.toFixed(2)}`);
  console.log(`Divergence: ${result.divergence_pct.toFixed(2)}%`);
  console.log(`Method: ${result.weighting_method}`);
  console.log(`Predictions: ${result.num_predictions} from ${result.num_agents} agents`);
} else {
  console.log('No active predictions found');
}
```

## Key Design Decisions

### Why 20 resolved predictions threshold?

20 predictions provides a statistically meaningful sample size to assess an agent's accuracy while not being too high a bar for new agents to contribute.

### Why median weight * 0.5 for new agents?

- Gives newer agents voice in consensus
- Conservative approach prevents unproven agents from dominating
- Balances inclusion with risk management

### Why trimmed mean for equal weight?

- Simple average can be heavily influenced by outliers
- 2 standard deviations removes extreme predictions
- More robust than median (which ignores all but middle values)

### Why insert instead of upsert?

The `consensus_prices` table is designed to track historical consensus calculations over time. Each call creates a new record with a timestamp, allowing analysis of how consensus evolves.

## Dependencies

- `supabaseAdmin` - Database client
- `getCachedMarketPrice` - Market price fetching with caching
- Tables required:
  - `predictions` (agent_id, ticker, target_price, status)
  - `agent_accuracy` (agent_id, weighted_avg_error_pct, total_resolved)
  - `consensus_prices` (for saving results)
  - `market_price_snapshots` (for price caching)

## Error Handling

- Returns `null` if no active predictions found
- Throws error if database operations fail
- Logs progress and results to console
