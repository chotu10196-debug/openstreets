import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, tweet_id } = body;

    // Validate input
    if (!agent_id || !tweet_id) {
      return NextResponse.json(
        { error: 'Agent ID and tweet ID are required' },
        { status: 400 }
      );
    }

    // Validate tweet_id format (should be numeric, 15-25 digits)
    if (!/^\d{15,25}$/.test(tweet_id)) {
      return NextResponse.json(
        { error: 'Invalid tweet_id format. Must be a numeric string (15-25 digits)' },
        { status: 400 }
      );
    }

    // Get agent
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.verified) {
      return NextResponse.json(
        { error: 'Agent already verified' },
        { status: 400 }
      );
    }

    // Mark agent as verified (simplified MVP - trusts agents)
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        verified: true,
        verification_tweet_id: tweet_id,
      })
      .eq('id', agent_id);

    if (updateError) {
      console.error('Error updating agent:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify agent' },
        { status: 500 }
      );
    }

    // Create portfolio with $100,000 starting cash
    const { data: portfolio, error: portfolioError } = await supabaseAdmin
      .from('portfolios')
      .insert({
        agent_id,
        cash_balance: 100000.00,
        total_value: 100000.00,
      })
      .select()
      .single();

    if (portfolioError) {
      console.error('Error creating portfolio:', portfolioError);
      return NextResponse.json(
        { error: 'Failed to create portfolio' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent verified successfully',
      portfolio: {
        cash_balance: portfolio.cash_balance,
        total_value: portfolio.total_value,
      },
    });
  } catch (error) {
    console.error('Error in verify endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
