import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FeedItem } from '@/types';

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

    // Get recent trades with agent info
    let query = supabaseAdmin
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

    // Apply filters
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    if (direction && direction !== 'ALL') {
      const action = direction === 'BULLISH' ? 'BUY' : 'SELL';
      query = query.eq('action', action);
    }
    const timeDate = getTimeFilterDate(time);
    if (timeDate) {
      query = query.gte('created_at', timeDate.toISOString());
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feed' },
        { status: 500 }
      );
    }

    // Transform to FeedItem format
    let feed: FeedItem[] = (trades || []).map((trade: any) => ({
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

    // Filter by agent name if specified
    if (agent) {
      feed = feed.filter((item) =>
        item.agent.name?.toLowerCase().includes(agent.toLowerCase())
      );
    }

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Error in feed endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
