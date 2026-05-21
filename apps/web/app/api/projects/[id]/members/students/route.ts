import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeRosterManager(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const fullName = parseFullName(body);
  if (!fullName) {
    return NextResponse.json({ error: 'Valid student name is required' }, { status: 400 });
  }

  const normalizedEmail = parseEmail(body);
  const { adminClient } = authorization;

  if (normalizedEmail) {
    const { data: existingByEmail, error: existingByEmailError } = await (adminClient as any)
      .from('member_profiles')
      .select('id')
      .eq('project_id', projectId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingByEmailError) {
      return NextResponse.json({ error: 'Failed to validate student email' }, { status: 500 });
    }

    if (existingByEmail?.id) {
      return NextResponse.json(
        { error: 'A student with this email already exists in the roster' },
        { status: 409 },
      );
    }
  }

  const { data, error } = await (adminClient as any)
    .from('member_profiles')
    .insert({
      project_id: projectId,
      full_name: fullName,
      email: normalizedEmail,
      account_id: null,
    })
    .select('id, project_id, account_id, full_name, email, role, joined_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create student profile' },
      { status: 400 },
    );
  }

  return NextResponse.json({ student: data }, { status: 200 });
}

async function authorizeRosterManager(projectId: string) {
  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: project, error: projectError } = await (client as any)
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return {
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  const isOwner = project.owner_id === user.id;
  let canManage = isOwner;

  if (!canManage) {
    const { data: selfMember } = await (client as any)
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('account_id', user.id)
      .maybeSingle();

    canManage = selfMember?.role === 'owner' || selfMember?.role === 'admin';
  }

  if (!canManage) {
    return {
      response: NextResponse.json(
        { error: 'Only owner/admin can manage the student roster' },
        { status: 403 },
      ),
    };
  }

  return { adminClient };
}

function parseFullName(body: unknown) {
  if (!body || typeof body !== 'object') return '';

  const raw = (body as { full_name?: unknown }).full_name;
  if (typeof raw !== 'string') return '';

  return raw.trim();
}

function parseEmail(body: unknown) {
  if (!body || typeof body !== 'object') return null;

  const raw = (body as { email?: unknown }).email;
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return null;

  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;

  return normalized;
}

