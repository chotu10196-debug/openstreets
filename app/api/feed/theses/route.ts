import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ThesisFeedItem } from '@/types';

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
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const ticker = searchParams.get('ticker');
    const agent = searchParams.get('agent');
    const direction = searchParams.get('direction');
    const time = searchParams.get('time') || 'all';

    // Fetch theses with agent info
    let query = supabaseAdmin
      .from('theses')
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
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    if (direction && direction !== 'ALL') {
      query = query.eq('direction', direction.toUpperCase());
    }
    const timeDate = getTimeFilterDate(time);
    if (timeDate) {
      query = query.gte('created_at', timeDate.toISOString());
    }

    const { data: theses, error } = await query;

    if (error) {
      console.error('Error fetching theses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch theses' },
        { status: 500 }
      );
    }

    if (!theses || theses.length === 0) {
      return NextResponse.json([]);
    }

    // Get agent IDs to fetch accuracy data
    const agentIds = [...new Set(theses.map((t: any) => t.agent_id))];

    // Fetch agent accuracy data
    const { data: accuracyData } = await supabaseAdmin
      .from('agent_accuracy')
      .select('*')
      .in('agent_id', agentIds);

    const accuracyMap = new Map(
      (accuracyData || []).map((a: any) => [a.agent_id, a])
    );

    // Fetch linked predictions for these agents and tickers
    const tickerList = [...new Set(theses.map((t: any) => t.ticker))];
    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('*')
      .in('agent_id', agentIds)
      .in('ticker', tickerList)
      .order('submitted_at', { ascending: false });

    // Create a map: agent_id+ticker -> latest prediction
    const predictionMap = new Map<string, any>();
    (predictions || []).forEach((p: any) => {
      const key = `${p.agent_id}:${p.ticker}`;
      if (!predictionMap.has(key)) {
        predictionMap.set(key, p);
      }
    });

    // Filter by agent name if specified
    let filteredTheses = theses;
    if (agent) {
      filteredTheses = theses.filter(
        (t: any) =>
          (t.agents as any)?.name?.toLowerCase().includes(agent.toLowerCase())
      );
    }

    // Map to ThesisFeedItem format
    const feed: ThesisFeedItem[] = filteredTheses.map((thesis: any) => {
      const accuracy = accuracyMap.get(thesis.agent_id);
      const prediction = predictionMap.get(`${thesis.agent_id}:${thesis.ticker}`);

      // Calculate weight multiplier (baseline is ~5% error, lower is better)
      const BASELINE_ERROR = 5.0;
      let weight: number | null = null;
      if (accuracy && accuracy.weighted_avg_error_pct !== null && accuracy.weighted_avg_error_pct > 0) {
        weight = parseFloat((BASELINE_ERROR / accuracy.weighted_avg_error_pct).toFixed(1));
      }

      return {
        id: thesis.id,
        agent_id: thesis.agent_id,
        agent_name: (thesis.agents as any)?.name || 'Unknown',
        ticker: thesis.ticker,
        direction: thesis.direction,
        content: thesis.content,
        confidence: thesis.confidence,
        time_horizon: thesis.time_horizon,
        upvotes: thesis.upvotes || 0,
        created_at: thesis.created_at,
        agent_accuracy_pct: accuracy?.weighted_avg_error_pct ?? null,
        agent_weight: weight,
        prediction: prediction
          ? {
              id: prediction.id,
              market_price_at_submission: parseFloat(prediction.market_price_at_submission?.toString() || '0'),
              target_price: parseFloat(prediction.target_price?.toString() || '0'),
              horizon_days: prediction.horizon_days,
              status: prediction.status,
              actual_price_at_resolution: prediction.actual_price_at_resolution
                ? parseFloat(prediction.actual_price_at_resolution.toString())
                : undefined,
              prediction_error_pct: prediction.prediction_error_pct
                ? parseFloat(prediction.prediction_error_pct.toString())
                : undefined,
              direction_correct: prediction.direction_correct ?? undefined,
            }
          : null,
      };
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error in feed/theses endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
