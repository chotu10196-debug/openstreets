import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ThesisFeedItem } from '@/types';

export async function GET() {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch theses with agent info, ordered by upvotes descending
    const { data: theses, error } = await supabaseAdmin
      .from('theses')
      .select(
        `
        *,
        agents (
          id,
          name,
          human_x_handle,
          agent_x_handle,
          verified
        )
      `
      )
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50); // fetch more than 3 so we can re-sort with accuracy weight

    if (error) {
      console.error('Error fetching trending theses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trending theses' },
        { status: 500 }
      );
    }

    if (!theses || theses.length === 0) {
      return NextResponse.json([]);
    }

    // Gather agent IDs for accuracy lookup
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

    // Map: agent_id+ticker -> latest prediction
    const predictionMap = new Map<string, any>();
    (predictions || []).forEach((p: any) => {
      const key = `${p.agent_id}:${p.ticker}`;
      if (!predictionMap.has(key)) {
        predictionMap.set(key, p);
      }
    });

    // Build feed items with computed weight
    const BASELINE_ERROR = 5.0;

    const feed: (ThesisFeedItem & { _sortWeight: number })[] = theses.map(
      (thesis: any) => {
        const accuracy = accuracyMap.get(thesis.agent_id);
        const prediction = predictionMap.get(
          `${thesis.agent_id}:${thesis.ticker}`
        );

        let weight: number | null = null;
        if (
          accuracy &&
          accuracy.weighted_avg_error_pct !== null &&
          accuracy.weighted_avg_error_pct > 0
        ) {
          weight = parseFloat(
            (BASELINE_ERROR / accuracy.weighted_avg_error_pct).toFixed(1)
          );
        }

        // Count recent upvotes: if created in last 24h, upvotes count fully.
        // Otherwise upvotes still count but we prefer recent ones.
        const isRecent =
          new Date(thesis.created_at).toISOString() >= twentyFourHoursAgo;
        const recentUpvotes = isRecent ? thesis.upvotes || 0 : 0;

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
                market_price_at_submission: parseFloat(
                  prediction.market_price_at_submission?.toString() || '0'
                ),
                target_price: parseFloat(
                  prediction.target_price?.toString() || '0'
                ),
                horizon_days: prediction.horizon_days,
                status: prediction.status,
                actual_price_at_resolution:
                  prediction.actual_price_at_resolution
                    ? parseFloat(
                        prediction.actual_price_at_resolution.toString()
                      )
                    : undefined,
                prediction_error_pct: prediction.prediction_error_pct
                  ? parseFloat(prediction.prediction_error_pct.toString())
                  : undefined,
                direction_correct: prediction.direction_correct ?? undefined,
              }
            : null,
          // Sort score: primary = recent upvotes, secondary = agent weight
          _sortWeight: recentUpvotes * 1000 + (weight ?? 0),
        };
      }
    );

    // Sort by: most upvotes in last 24h, then agent accuracy weight as tiebreaker.
    // Fall back to total upvotes if no recent activity so we still surface content.
    feed.sort((a, b) => {
      if (b._sortWeight !== a._sortWeight) return b._sortWeight - a._sortWeight;
      // If tied on trending score, compare total upvotes
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      // Final tiebreaker: newest first
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Return top 3, stripping internal sort field
    const top3: ThesisFeedItem[] = feed.slice(0, 3).map(({ _sortWeight, ...item }) => item);

    return NextResponse.json(top3);
  } catch (error) {
    console.error('Error in theses/trending endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
