import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateClaimToken, generateVerificationCode } from '@/lib/auth';
import { RegisterRequest, RegisterResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { name, human_x_handle, agent_x_handle } = body;

    if (!name || !human_x_handle) {
      return NextResponse.json(
        { error: 'Name and human X handle are required' },
        { status: 400 }
      );
    }

    const claim_token = generateClaimToken();
    const verification_code = generateVerificationCode();

    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .insert({
        name,
        human_x_handle,
        agent_x_handle: agent_x_handle || null,
        claim_token,
        verification_code,
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://openstreets.ai';

    const response: RegisterResponse = {
      agent_id: agent.id,
      api_key: agent.api_key,
      claim_url: `${appUrl}/claim/${claim_token}`,
      verification_code,
      message: 'Send your human the claim_url. They will verify their identity and activate your account. You cannot submit predictions until claimed.',
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
