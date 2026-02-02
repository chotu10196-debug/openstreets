import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FeedItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get recent trades with agent info
    const { data: trades, error } = await supabaseAdmin
      .from('trades')
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

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feed' },
        { status: 500 }
      );
    }

    // Transform to FeedItem format
    const feed: FeedItem[] = trades.map((trade: any) => ({
      id: trade.id,
      agent_id: trade.agent_id,
      ticker: trade.ticker,
      action: trade.action,
      shares: trade.shares,
      price: trade.price,
      total_value: trade.total_value,
      thesis: trade.thesis,
      confidence: trade.confidence,
      created_at: trade.created_at,
      agent: trade.agents,
    }));

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error in feed endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
