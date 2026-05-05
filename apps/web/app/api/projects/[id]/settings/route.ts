import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';
type ProjectStatus = 'active' | 'paused' | 'archived' | 'coming_up' | 'restoring';

const STATUS_VALUES: ProjectStatus[] = ['active', 'paused', 'archived', 'coming_up', 'restoring'];

export async function GET(_request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  const { data, error } = await (adminClient as any)
    .from('projects')
    .select('id, name, description, status')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      settings: {
        name: data.name ?? '',
        description: data.description ?? '',
        status: data.status ?? 'active',
      },
      permissions: {
        role,
        canManage: canManageProjectSettings(role),
      },
    },
    { status: 200 },
  );
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;
  if (!canManageProjectSettings(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseSettingsBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
  }

  const { error } = await (adminClient as any)
    .from('projects')
    .update({
      name: parsed.name,
      description: parsed.description,
      status: parsed.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  if (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function parseSettingsBody(body: unknown) {
  if (!body || typeof body !== 'object') return null;

  const rawStatus = (body as { status?: unknown }).status;
  const rawName = (body as { name?: unknown }).name;
  const rawDescription = (body as { description?: unknown }).description;

  if (typeof rawStatus !== 'string' || !STATUS_VALUES.includes(rawStatus as ProjectStatus)) {
    return null;
  }

  if (typeof rawName !== 'string' || typeof rawDescription !== 'string') {
    return null;
  }

  const name = rawName.trim();
  const description = rawDescription.trim();
  if (!name) return null;

  return {
    name,
    description: description || null,
    status: rawStatus as ProjectStatus,
  };
}

async function authorizeProjectAccess(projectId: string) {
  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: project, error: projectError } = await (client as any)
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return { response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  if (project.owner_id === user.id) {
    return { adminClient, role: 'owner' as const };
  }

  const { data: selfMember, error: memberError } = await (client as any)
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('account_id', user.id)
    .maybeSingle();

  if (memberError) {
    return { response: NextResponse.json({ error: 'Failed to verify project access' }, { status: 500 }) };
  }

  const role = normalizeProjectRole(selfMember?.role);
  if (!role) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { adminClient, role };
}

function normalizeProjectRole(value: unknown): ProjectAccessRole | null {
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }
  return null;
}

function canManageProjectSettings(role: ProjectAccessRole) {
  return role === 'owner' || role === 'admin';
}
