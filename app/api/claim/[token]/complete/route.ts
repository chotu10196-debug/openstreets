import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, name, verification_code, owner_user_id, verified')
      .eq('claim_token', token)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 404 }
      );
    }

    if (agent.verified) {
      return NextResponse.json(
        { error: 'Agent already claimed' },
        { status: 400 }
      );
    }

    if (agent.owner_user_id !== user.id) {
      return NextResponse.json(
        { error: 'This claim belongs to a different user' },
        { status: 403 }
      );
    }

    // Extract X handle from linked identity
    const xIdentity = user.identities?.find(
      (i) => i.provider === 'twitter' || i.provider === 'x'
    );

    if (!xIdentity) {
      return NextResponse.json(
        { error: 'X account not linked. Connect with X first.' },
        { status: 400 }
      );
    }

    const ownerXHandle = (xIdentity.identity_data as Record<string, unknown>)?.user_name as string
      || (xIdentity.identity_data as Record<string, unknown>)?.preferred_username as string
      || '';

    // Verify the tweet using the provider token if available
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    let tweetVerified = false;

    if (bearerToken && ownerXHandle) {
      try {
        // Search recent tweets from the user for the verification code
        const searchQuery = encodeURIComponent(
          `from:${ownerXHandle} "${agent.verification_code}"`
        );
        const response = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${searchQuery}`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );

        if (response.ok) {
          const data = await response.json();
          tweetVerified = (data.meta?.result_count ?? 0) > 0;
        }
      } catch (err) {
        console.error('Tweet verification search failed:', err);
      }
    }

    if (!bearerToken) {
      // In development without Twitter API, trust the flow
      tweetVerified = true;
    }

    if (!tweetVerified) {
      return NextResponse.json(
        {
          error: 'Could not find verification tweet',
          hint: `Post a tweet from @${ownerXHandle} containing "${agent.verification_code}" and try again.`,
        },
        { status: 400 }
      );
    }

    // Mark agent as verified and claimed
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        verified: true,
        claimed_at: new Date().toISOString(),
        owner_x_handle: ownerXHandle,
        claim_step: 3,
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Error completing claim:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete claim' },
        { status: 500 }
      );
    }

    // Create portfolio with $100,000 starting cash
    const { error: portfolioError } = await supabaseAdmin
      .from('portfolios')
      .insert({
        agent_id: agent.id,
        cash_balance: 100000.00,
        total_value: 100000.00,
      });

    if (portfolioError) {
      console.error('Error creating portfolio:', portfolioError);
    }

    return NextResponse.json({
      success: true,
      message: `Agent "${agent.name}" is now claimed and active! Predictions can be submitted.`,
      agent_name: agent.name,
    });
  } catch (error) {
    console.error('Error in claim complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
