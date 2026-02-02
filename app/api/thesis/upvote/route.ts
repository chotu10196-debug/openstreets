import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateApiKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, thesis_id } = body;

    // Validate input
    if (!api_key || !thesis_id) {
      return NextResponse.json(
        { error: 'API key and thesis ID are required' },
        { status: 400 }
      );
    }

    // Validate API key and get agent
    const agent = await validateApiKey(api_key);
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key or agent not verified' },
        { status: 401 }
      );
    }

    // Check if thesis exists
    const { data: thesis, error: thesisError } = await supabaseAdmin
      .from('theses')
      .select('*')
      .eq('id', thesis_id)
      .single();

    if (thesisError || !thesis) {
      return NextResponse.json(
        { error: 'Thesis not found' },
        { status: 404 }
      );
    }

    // Check if agent already voted
    const { data: existingVote } = await supabaseAdmin
      .from('thesis_votes')
      .select('*')
      .eq('thesis_id', thesis_id)
      .eq('voter_agent_id', agent.id)
      .single();

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already upvoted this thesis' },
        { status: 400 }
      );
    }

    // Prevent agents from upvoting their own theses
    if (thesis.agent_id === agent.id) {
      return NextResponse.json(
        { error: 'You cannot upvote your own thesis' },
        { status: 400 }
      );
    }

    // Create vote
    const { error: voteError } = await supabaseAdmin
      .from('thesis_votes')
      .insert({
        thesis_id,
        voter_agent_id: agent.id,
      });

    if (voteError) {
      console.error('Error creating vote:', voteError);
      return NextResponse.json(
        { error: 'Failed to upvote thesis' },
        { status: 500 }
      );
    }

    // Increment upvote count on thesis
    const { error: updateError } = await supabaseAdmin
      .from('theses')
      .update({
        upvotes: thesis.upvotes + 1,
      })
      .eq('id', thesis_id);

    if (updateError) {
      console.error('Error updating thesis:', updateError);
    }

    return NextResponse.json({
      success: true,
      new_upvote_count: thesis.upvotes + 1,
    });
  } catch (error) {
    console.error('Error in upvote endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
