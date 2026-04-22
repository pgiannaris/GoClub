import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  const client = getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invitation, error: inviteError } = await (client as any)
    .from('project_invitations')
    .select('id, status')
    .eq('id', invitationId)
    .eq('invited_account_id', user.id)
    .maybeSingle();

  if (inviteError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 409 });
  }

  const { error: updateError } = await (client as any)
    .from('project_invitations')
    .update({
      status: 'dismissed',
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .eq('invited_account_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
