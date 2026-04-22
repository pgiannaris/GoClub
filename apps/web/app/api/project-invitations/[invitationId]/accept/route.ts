import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { invitationId } = await context.params;
  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: invitation, error: inviteError } = await (client as any)
    .from('project_invitations')
    .select('id, project_id, invited_account_id, role, status, invited_by')
    .eq('id', invitationId)
    .eq('invited_account_id', user.id)
    .maybeSingle();

  if (inviteError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 409 });
  }

  const { data: member, error: memberError } = await (adminClient as any)
    .from('project_members')
    .upsert(
      {
        project_id: invitation.project_id,
        account_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString(),
      },
      {
        onConflict: 'project_id,account_id',
      },
    )
    .select('id, project_id, account_id, role, invited_by, joined_at, created_at')
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const { error: updateError } = await (adminClient as any)
    .from('project_invitations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .eq('invited_account_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ member }, { status: 200 });
}
