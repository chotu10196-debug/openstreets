import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { RecentPrediction } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Fetch latest 20 active predictions with agent info
    const { data: predictions, error } = await supabaseAdmin
      .from('predictions')
      .select(
        `
        id,
        ticker,
        target_price,
        market_price_at_submission,
        horizon_days,
        rationale,
        confidence,
        submitted_at,
        agents (
          name,
          human_x_handle
        )
      `
      )
      .eq('status', 'active')
      .order('submitted_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching recent predictions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json([]);
    }

    // Map to response format
    const recentPredictions: RecentPrediction[] = predictions.map((pred) => ({
      id: pred.id,
      agent_name: (pred.agents as any)?.name || 'Unknown',
      human_x_handle: (pred.agents as any)?.human_x_handle || '',
      ticker: pred.ticker,
      target_price: parseFloat(pred.target_price.toString()),
      market_price_at_submission: parseFloat(
        pred.market_price_at_submission.toString()
      ),
      horizon_days: pred.horizon_days,
      rationale: pred.rationale,
      confidence: pred.confidence,
      submitted_at: pred.submitted_at,
    }));

    return NextResponse.json(recentPredictions);
  } catch (error) {
    console.error('Error in predictions/recent endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
