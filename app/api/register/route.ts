import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateVerificationText } from '@/lib/auth';
import { RegisterRequest, RegisterResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { name, human_x_handle, agent_x_handle } = body;

    // Validate input
    if (!name || !human_x_handle) {
      return NextResponse.json(
        { error: 'Name and human X handle are required' },
        { status: 400 }
      );
    }

    // Create agent record
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .insert({
        name,
        human_x_handle,
        agent_x_handle: agent_x_handle || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      );
    }

    // Generate verification instructions
    const verificationText = generateVerificationText(agent.id);

    const response: RegisterResponse = {
      agent_id: agent.id,
      api_key: agent.api_key,
      verification_instructions: {
        step1: `Tweet the following text exactly as shown from @${agent_x_handle || human_x_handle}`,
        tweet_text: verificationText,
        step2: 'After posting, copy the numeric ID from your tweet URL (e.g. x.com/you/status/THIS_NUMBER)',
        step3: `Call POST /api/verify with body: { "agent_id": "${agent.id}", "tweet_id": "PASTE_TWEET_ID_HERE" }`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in register endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
