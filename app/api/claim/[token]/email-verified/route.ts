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
        { error: 'Not authenticated. Complete email verification first.' },
        { status: 401 }
      );
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, claim_step, verified')
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

    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        owner_user_id: user.id,
        owner_email: user.email,
        claim_step: 1,
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Error updating agent:', updateError);
      return NextResponse.json(
        { error: 'Failed to record email verification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified. Now post the verification tweet.',
      claim_step: 1,
    });
  } catch (error) {
    console.error('Error in email-verified:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
