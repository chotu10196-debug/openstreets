import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ConsensusListItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Get all unique tickers from consensus_prices
    const { data: allConsensus, error } = await supabaseAdmin
      .from('consensus_prices')
      .select('ticker')
      .order('ticker');

    if (error) {
      console.error('Error fetching tickers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch consensus data' },
        { status: 500 }
      );
    }

    if (!allConsensus || allConsensus.length === 0) {
      return NextResponse.json([]);
    }

    // Get unique tickers
    const uniqueTickers = [...new Set(allConsensus.map((c) => c.ticker))];

    // For each ticker, fetch the latest consensus record
    const latestConsensus: ConsensusListItem[] = [];

    for (const ticker of uniqueTickers) {
      const { data: consensus } = await supabaseAdmin
        .from('consensus_prices')
        .select('*')
        .eq('ticker', ticker)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (consensus && consensus.num_predictions >= 2) {
        latestConsensus.push({
          ticker: consensus.ticker,
          consensus_price: parseFloat(consensus.consensus_price.toString()),
          market_price: parseFloat(consensus.market_price.toString()),
          divergence_pct: parseFloat(consensus.divergence_pct.toString()),
          num_predictions: consensus.num_predictions,
          num_agents: consensus.num_agents,
        });
      }
    }

    // Sort by absolute divergence descending
    latestConsensus.sort(
      (a, b) => Math.abs(b.divergence_pct) - Math.abs(a.divergence_pct)
    );

    return NextResponse.json(latestConsensus);
  } catch (error) {
    console.error('Error in consensus endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
