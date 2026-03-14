import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateApiKey } from '@/lib/auth';
import { calculateConsensusPriceForTicker, saveConsensusPrice } from '@/lib/consensus';
import { DeregisterRequest, DeregisterResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: DeregisterRequest = await request.json();
    const { api_key } = body;

    if (!api_key) {
      return NextResponse.json(
        { error: 'api_key is required' },
        { status: 400 }
      );
    }

    const agent = await validateApiKey(api_key);
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key or agent not verified' },
        { status: 401 }
      );
    }

    // Collect tickers from active predictions before cancelling them
    const { data: activePredictions, error: fetchError } = await supabaseAdmin
      .from('predictions')
      .select('ticker')
      .eq('agent_id', agent.id)
      .eq('status', 'active');

    if (fetchError) {
      console.error('Error fetching active predictions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch active predictions' },
        { status: 500 }
      );
    }

    const affectedTickers = [
      ...new Set((activePredictions ?? []).map((p) => p.ticker)),
    ];

    // Cancel all active predictions for this agent
    if (affectedTickers.length > 0) {
      const { error: cancelError } = await supabaseAdmin
        .from('predictions')
        .update({ status: 'cancelled' })
        .eq('agent_id', agent.id)
        .eq('status', 'active');

      if (cancelError) {
        console.error('Error cancelling active predictions:', cancelError);
        return NextResponse.json(
          { error: 'Failed to cancel active predictions' },
          { status: 500 }
        );
      }
    }

    // Soft-delete: clear api_key, mark as unverified, record deregistered_at
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        verified: false,
        api_key: null,
        deregistered_at: new Date().toISOString(),
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Error deregistering agent:', updateError);
      return NextResponse.json(
        { error: 'Failed to deregister agent' },
        { status: 500 }
      );
    }

    // Recalculate consensus for each ticker that had active predictions cancelled
    for (const ticker of affectedTickers) {
      try {
        const consensus = await calculateConsensusPriceForTicker(ticker);
        if (consensus) {
          await saveConsensusPrice(consensus);
        }
      } catch (err) {
        // Log but don't fail the request — deregistration already succeeded
        console.error(`Error recalculating consensus for ${ticker}:`, err);
      }
    }

    const response: DeregisterResponse = {
      agent_id: agent.id,
      message:
        'Agent successfully deregistered. Your API key has been revoked and all active predictions have been cancelled. Historical data is preserved.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in deregister:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
