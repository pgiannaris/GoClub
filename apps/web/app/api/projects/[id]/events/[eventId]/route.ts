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

export async function PATCH(request: Request, context: ProjectRouteContext) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const parsed = parseEventBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Valid event data is required' },
      { status: 400 },
    );
  }

  const { data, error } = await (adminClient as any)
    .from('events')
    .update({
      title: parsed.title,
      description: parsed.description,
      start_at: parsed.start_at,
      end_at: parsed.end_at,
      location: parsed.location,
      status: parsed.status,
      visibility: parsed.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('project_id', projectId)
    .select(
      'id, project_id, title, description, start_at, end_at, location, rsvp_url, status, visibility, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    console.error('Failed to update event', { projectId, eventId, error });
    return NextResponse.json(
      { error: error?.message || 'Failed to update event' },
      { status: 400 },
    );
  }

  void dispatchProjectWebhook(adminClient, projectId, 'event.updated', data);
  return NextResponse.json({ event: data }, { status: 200 });
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
      response: NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      ),
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
      response: NextResponse.json(
        { error: 'Failed to verify project access' },
        { status: 500 },
      ),
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
  if (
    value === 'owner' ||
    value === 'admin' ||
    value === 'member' ||
    value === 'viewer'
  ) {
    return value;
  }

  return null;
}

function canManageEvents(role: ProjectAccessRole) {
  return role === 'owner' || role === 'admin' || role === 'member';
}

function parseEventBody(body: unknown) {
  if (!body || typeof body !== 'object') return null;

  const rawTitle = (body as { title?: unknown }).title;
  const rawDescription = (body as { description?: unknown }).description;
  const rawStartAt = (body as { start_at?: unknown }).start_at;
  const rawEndAt = (body as { end_at?: unknown }).end_at;
  const rawLocation = (body as { location?: unknown }).location;
  const rawStatus = (body as { status?: unknown }).status;
  const rawVisibility = (body as { visibility?: unknown }).visibility;

  if (typeof rawTitle !== 'string' || typeof rawStartAt !== 'string') {
    return null;
  }

  const title = rawTitle.trim();
  const startAt = normalizeIsoDate(rawStartAt);
  const endAt =
    typeof rawEndAt === 'string' && rawEndAt.trim()
      ? normalizeIsoDate(rawEndAt)
      : null;

  if (!title || !startAt) return null;
  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime())
    return null;

  return {
    title,
    description:
      typeof rawDescription === 'string' ? rawDescription.trim() || null : null,
    start_at: startAt,
    end_at: endAt,
    location:
      typeof rawLocation === 'string' ? rawLocation.trim() || null : null,
    status: normalizeEventStatus(rawStatus),
    visibility: normalizeEventVisibility(rawVisibility),
  };
}

function normalizeIsoDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function normalizeEventStatus(value: unknown) {
  if (value === 'cancelled' || value === 'completed') return value;
  return 'scheduled';
}

function normalizeEventVisibility(value: unknown) {
  if (value === 'members') return value;
  return 'public';
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
    console.error('Failed to dispatch project webhook', {
      projectId,
      webhookUrl,
      error,
    });
  }
}
