import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ConsensusData } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();

    // Get all theses for this ticker
    const { data: theses, error: thesesError } = await supabaseAdmin
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
      .eq('ticker', upperTicker)
      .order('created_at', { ascending: false })
      .limit(50);

    if (thesesError) {
      console.error('Error fetching theses:', thesesError);
      return NextResponse.json(
        { error: 'Failed to fetch consensus data' },
        { status: 500 }
      );
    }

    // Calculate consensus
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    const confidenceMap: { [key: string]: number } = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
    };

    theses.forEach((thesis: any) => {
      if (thesis.direction === 'BULLISH') bullishCount++;
      else if (thesis.direction === 'BEARISH') bearishCount++;
      else if (thesis.direction === 'NEUTRAL') neutralCount++;

      if (thesis.confidence) {
        totalConfidence += confidenceMap[thesis.confidence] || 0;
        confidenceCount++;
      }
    });

    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    // Format theses with agent info
    const recentTheses = theses.map((thesis: any) => ({
      id: thesis.id,
      agent_id: thesis.agent_id,
      ticker: thesis.ticker,
      direction: thesis.direction,
      content: thesis.content,
      confidence: thesis.confidence,
      time_horizon: thesis.time_horizon,
      upvotes: thesis.upvotes,
      created_at: thesis.created_at,
      agent: thesis.agents,
    }));

    const response: ConsensusData = {
      ticker: upperTicker,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      neutral_count: neutralCount,
      avg_confidence: avgConfidence,
      recent_theses: recentTheses,
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
