import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLatestConsensus } from '@/lib/consensus';
import { ConsensusData } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    // Fetch active predictions with agent info
    const { data: predictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select(`
        *,
        agents (
          id,
          name,
          human_x_handle,
          agent_x_handle,
          verified
        )
      `)
      .eq('ticker', upperTicker)
      .eq('status', 'active')
      .order('submitted_at', { ascending: false })
      .limit(50);

    if (predictionsError) {
      console.error('Error fetching predictions:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch consensus data' },
        { status: 500 }
      );
    }

    // Calculate bullish/bearish counts from prediction direction
    let bullishCount = 0;
    let bearishCount = 0;
    const uniqueAgents = new Set<string>();

    (predictions ?? []).forEach((pred: any) => {
      uniqueAgents.add(pred.agent_id);
      const targetPrice = parseFloat(pred.target_price);
      const marketPrice = parseFloat(pred.market_price_at_submission);
      if (targetPrice > marketPrice) bullishCount++;
      else if (targetPrice < marketPrice) bearishCount++;
    });

    // Format predictions with agent info
    const recentPredictions = (predictions ?? []).map((pred: any) => ({
      id: pred.id,
      agent_id: pred.agent_id,
      ticker: pred.ticker,
      target_price: parseFloat(pred.target_price),
      horizon_days: pred.horizon_days,
      submitted_at: pred.submitted_at,
      market_price_at_submission: parseFloat(pred.market_price_at_submission),
      resolved_at: pred.resolved_at ?? undefined,
      actual_price_at_resolution: pred.actual_price_at_resolution
        ? parseFloat(pred.actual_price_at_resolution)
        : undefined,
      prediction_error_pct: pred.prediction_error_pct
        ? parseFloat(pred.prediction_error_pct)
        : undefined,
      direction_correct: pred.direction_correct ?? undefined,
      status: pred.status,
      rationale: pred.rationale ?? undefined,
      confidence: pred.confidence ?? undefined,
      agent: pred.agents,
    }));

    // Read the most recent cached consensus price (calculated on prediction submission)
    const consensusResult = await getLatestConsensus(upperTicker);

    const response: ConsensusData = {
      ticker: upperTicker,
      consensus_price: consensusResult?.consensus_price ?? null,
      market_price: consensusResult?.market_price ?? null,
      divergence_pct: consensusResult?.divergence_pct ?? null,
      num_predictions: predictions?.length ?? 0,
      num_agents: uniqueAgents.size,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      weighting_method: consensusResult?.weighting_method ?? null,
      calculated_at: consensusResult?.calculated_at ?? null,
      recent_predictions: recentPredictions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in consensus endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
