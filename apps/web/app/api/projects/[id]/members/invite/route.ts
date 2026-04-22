import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const ALLOWED_ROLES = new Set(['admin', 'member', 'viewer']);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const client = getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = parseEmail(body);
  const role = parseRole(body);

  if (!email) {
    return NextResponse.json({ error: 'Valid collaborator email is required' }, { status: 400 });
  }

  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'Role must be admin, member, or viewer' },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await (client as any)
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const isOwner = project.owner_id === user.id;
  let canManageMembers = isOwner;

  if (!canManageMembers) {
    const { data: selfMember } = await (client as any)
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('account_id', user.id)
      .maybeSingle();

    canManageMembers = selfMember?.role === 'owner' || selfMember?.role === 'admin';
  }

  if (!canManageMembers) {
    return NextResponse.json(
      { error: 'Only owner/admin can manage collaborators' },
      { status: 403 },
    );
  }

  const adminClient = getSupabaseServerAdminClient();
  const { data: account, error: accountError } = await (adminClient as any)
    .from('accounts')
    .select('id, email')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: 'Failed to resolve collaborator account' }, { status: 500 });
  }

  if (!account?.id) {
    return NextResponse.json(
      {
        error:
          'No account found with that email. Ask them to create an account first, then invite again.',
      },
      { status: 404 },
    );
  }

  const { data: existingMember } = await (client as any)
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('account_id', account.id)
    .maybeSingle();

  if (existingMember?.id) {
    return NextResponse.json({ error: 'This user is already a collaborator' }, { status: 409 });
  }

  const { data: invitation, error: inviteError } = await (client as any)
    .from('project_invitations')
    .upsert(
      {
        project_id: projectId,
        invited_account_id: account.id,
        invited_email: account.email ?? email,
        role,
        status: 'pending',
        invited_by: user.id,
        responded_at: null,
      },
      {
        onConflict: 'project_id,invited_account_id',
      },
    )
    .select('id, project_id, invited_account_id, invited_email, role, status, invited_by, responded_at, created_at, updated_at')
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  return NextResponse.json({ invitation }, { status: 200 });
}

function parseEmail(body: unknown) {
  if (!body || typeof body !== 'object') return '';
  const raw = (body as { email?: unknown }).email;
  if (typeof raw !== 'string') return '';

  const value = raw.trim().toLowerCase();
  if (!value.includes('@') || value.length > 320) return '';
  return value;
}

function parseRole(body: unknown) {
  if (!body || typeof body !== 'object') return '';
  const raw = (body as { role?: unknown }).role;
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}
