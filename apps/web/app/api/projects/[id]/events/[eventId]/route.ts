/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string; eventId: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  const { id: projectId, eventId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  if (!canManageEvents(role)) {
    return NextResponse.json(
      { error: 'Only owner, admin, or member can manage events' },
      { status: 403 },
    );
  }

  const { error } = await (adminClient as any)
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('project_id', projectId);

  if (error) {
    console.error('Failed to delete event', { projectId, eventId, error });
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 400 },
    );
  }

  void dispatchProjectWebhook(adminClient, projectId, 'event.deleted', {
    id: eventId,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function authorizeProjectAccess(projectId: string) {
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
    console.error('Failed to authorize project access for event delete', {
      projectId,
      userId: user.id,
      memberError,
    });

    return {
      response: NextResponse.json({ error: 'Failed to verify project access' }, { status: 500 }),
    };
  }

  const role = normalizeProjectRole(selfMember?.role);
  if (!role) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { adminClient, role };
}

function normalizeProjectRole(value: unknown): ProjectAccessRole | null {
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }

  return null;
}

function canManageEvents(role: ProjectAccessRole) {
  return role === 'owner' || role === 'admin' || role === 'member';
}

async function dispatchProjectWebhook(
  adminClient: any,
  projectId: string,
  eventType: string,
  eventPayload: unknown,
) {
  const { data: project } = await (adminClient as any)
    .from('projects')
    .select('id, webhook_url, api_key')
    .eq('id', projectId)
    .maybeSingle();

  const webhookUrl = project?.webhook_url as string | null | undefined;
  if (!webhookUrl) return;

  const apiKey = project?.api_key as string | null | undefined;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        type: eventType,
        projectId,
        timestamp: new Date().toISOString(),
        payload: eventPayload,
      }),
    });
  } catch (error) {
    console.error('Failed to dispatch project webhook', { projectId, webhookUrl, error });
  }
}
