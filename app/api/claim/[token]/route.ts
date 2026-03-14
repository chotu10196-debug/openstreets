import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateClaimTweetText } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .select('id, name, human_x_handle, agent_x_handle, claim_step, verification_code, verified, claimed_at')
      .eq('claim_token', token)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 404 }
      );
    }

    if (agent.verified && agent.claimed_at) {
      return NextResponse.json(
        { error: 'Agent already claimed', agent_name: agent.name },
        { status: 400 }
      );
    }

    const tweetText = generateClaimTweetText(agent.name, agent.verification_code);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        human_x_handle: agent.human_x_handle,
        agent_x_handle: agent.agent_x_handle,
      },
      claim_step: agent.claim_step ?? 0,
      verification_code: agent.verification_code,
      tweet_text: tweetText,
      claimed: false,
    });
  } catch (error) {
    console.error('Error in claim GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
