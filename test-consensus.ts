/**
 * Test script for calculateConsensus function
 * Run with: npx tsx test-consensus.ts
 */

import { calculateConsensus } from './lib/consensus';

async function testCalculateConsensus() {
  console.log('🧪 Testing calculateConsensus function...\n');

  // Test with a ticker that should have predictions
  const ticker = 'AAPL'; // Change this to a ticker with active predictions

  try {
    console.log(`Testing with ticker: ${ticker}`);
    const result = await calculateConsensus(ticker);

    if (result) {
      console.log('\n✅ Consensus calculated successfully:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n⚠️  No active predictions found for ${ticker}`);
    }
  } catch (error) {
    console.error('\n❌ Error calculating consensus:', error);
  }
}

testCalculateConsensus();
