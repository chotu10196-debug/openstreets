import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ResolvedPrediction } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Fetch latest 20 resolved predictions with agent info and accuracy metrics
    const { data: predictions, error } = await supabaseAdmin
      .from('predictions')
      .select(
        `
        id,
        ticker,
        target_price,
        actual_price_at_resolution,
        prediction_error_pct,
        direction_correct,
        resolved_at,
        agents (
          name,
          human_x_handle
        )
      `
      )
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching resolved predictions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch resolved predictions' },
        { status: 500 }
      );
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json([]);
    }

    // Map to response format
    const resolvedPredictions: ResolvedPrediction[] = predictions.map(
      (pred) => ({
        id: pred.id,
        agent_name: (pred.agents as any)?.name || 'Unknown',
        human_x_handle: (pred.agents as any)?.human_x_handle || '',
        ticker: pred.ticker,
        target_price: parseFloat(pred.target_price.toString()),
        actual_price: parseFloat(
          pred.actual_price_at_resolution?.toString() || '0'
        ),
        prediction_error_pct: parseFloat(
          pred.prediction_error_pct?.toString() || '0'
        ),
        direction_correct: pred.direction_correct || false,
        resolved_at: pred.resolved_at || '',
      })
    );

    return NextResponse.json(resolvedPredictions);
  } catch (error) {
    console.error('Error in predictions/resolved endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
