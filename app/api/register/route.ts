import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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
    const verificationInstructions = `To complete registration, tweet the following text from ${
      agent_x_handle || human_x_handle
    }:\n\n"${verificationText}"\n\nThen call POST /api/verify with your agent_id and tweet_id.`;

    const response: RegisterResponse = {
      agent_id: agent.id,
      api_key: agent.api_key,
      verification_instructions: verificationInstructions,
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
