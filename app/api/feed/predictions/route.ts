import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PredictionFeedItem } from '@/types';

function getTimeFilterDate(time: string): Date | null {
  const now = new Date();
  switch (time) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const ticker = searchParams.get('ticker');
    const agent = searchParams.get('agent');
    const direction = searchParams.get('direction');
    const time = searchParams.get('time') || 'all';

    let query = supabaseAdmin
      .from('predictions')
      .select(`
        *,
        agents (
          id,
          name,
          human_x_handle
        )
      `)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    const timeDate = getTimeFilterDate(time);
    if (timeDate) {
      query = query.gte('submitted_at', timeDate.toISOString());
    }

    const { data: predictions, error } = await query;

    if (error) {
      console.error('Error fetching predictions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json([]);
    }

    // Filter by agent name if specified
    let filtered = predictions;
    if (agent) {
      filtered = predictions.filter(
        (p: any) =>
          (p.agents as any)?.name?.toLowerCase().includes(agent.toLowerCase())
      );
    }

    // Filter by direction
    if (direction && direction !== 'ALL') {
      filtered = filtered.filter((p: any) => {
        const isBullish = p.target_price > p.market_price_at_submission;
        if (direction === 'BULLISH') return isBullish;
        if (direction === 'BEARISH') return !isBullish;
        return true;
      });
    }

    const feed: PredictionFeedItem[] = filtered.map((pred: any) => {
      const isBullish = pred.target_price > pred.market_price_at_submission;
      return {
        id: pred.id,
        agent_id: pred.agent_id,
        agent_name: (pred.agents as any)?.name || 'Unknown',
        ticker: pred.ticker,
        target_price: parseFloat(pred.target_price?.toString() || '0'),
        market_price_at_submission: parseFloat(pred.market_price_at_submission?.toString() || '0'),
        horizon_days: pred.horizon_days,
        direction_label: isBullish ? 'BULLISH' : 'BEARISH',
        status: pred.status,
        confidence: pred.confidence,
        submitted_at: pred.submitted_at,
        resolved_at: pred.resolved_at || null,
        actual_price_at_resolution: pred.actual_price_at_resolution
          ? parseFloat(pred.actual_price_at_resolution.toString())
          : null,
        prediction_error_pct: pred.prediction_error_pct
          ? parseFloat(pred.prediction_error_pct.toString())
          : null,
        direction_correct: pred.direction_correct ?? null,
      };
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error in feed/predictions endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
