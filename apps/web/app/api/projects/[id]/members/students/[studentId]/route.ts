import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string; studentId: string }>;
};

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { id: projectId, studentId } = await context.params;
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

  const { adminClient } = authorization;
  const { data, error } = await (adminClient as any)
    .from('member_profiles')
    .update({
      full_name: fullName,
    })
    .eq('id', studentId)
    .eq('project_id', projectId)
    .select('id, project_id, account_id, full_name, email, role, joined_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to update student' }, { status: 400 });
  }

  return NextResponse.json({ student: data }, { status: 200 });
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  const { id: projectId, studentId } = await context.params;
  const authorization = await authorizeRosterManager(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient } = authorization;
  const { data: student, error: loadError } = await (adminClient as any)
    .from('member_profiles')
    .select('id, project_id, account_id, full_name, email, role, joined_at')
    .eq('id', studentId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (loadError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const { error } = await (adminClient as any)
    .from('member_profiles')
    .delete()
    .eq('id', studentId)
    .eq('project_id', projectId);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to remove student' }, { status: 400 });
  }

  return NextResponse.json({ student }, { status: 200 });
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

  return { adminClient, user };
}

function parseFullName(body: unknown) {
  if (!body || typeof body !== 'object') return '';

  const raw = (body as { full_name?: unknown }).full_name;
  if (typeof raw !== 'string') return '';

  return raw.trim();
}
