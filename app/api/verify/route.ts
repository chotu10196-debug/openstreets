import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateVerificationText, verifyTweet } from '@/lib/auth';
import { VerifyRequest, VerifyResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { agent_id, tweet_id } = body;

    // Validate input
    if (!agent_id || !tweet_id) {
      return NextResponse.json(
        { error: 'Agent ID and tweet ID are required' },
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

    // Verify tweet
    const expectedText = generateVerificationText(agent_id);
    const isValid = await verifyTweet(tweet_id, expectedText);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Tweet verification failed. Make sure the tweet contains the correct verification text.' },
        { status: 400 }
      );
    }

    // Mark agent as verified
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

    const response: VerifyResponse = {
      verified: true,
      portfolio,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in verify endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
