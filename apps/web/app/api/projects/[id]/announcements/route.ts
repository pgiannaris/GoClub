import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectManager(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseAnnouncementBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Valid announcement data is required' }, { status: 400 });
  }

  const { client } = authorization;
  const { data, error } = await (client as any)
    .from('announcements')
    .insert({
      project_id: projectId,
      title: parsed.title,
      body: parsed.body,
      status: parsed.status,
      is_pinned: parsed.is_pinned,
      published_at: parsed.published_at,
    })
    .select('id, title, body, status, is_pinned, published_at, created_at')
    .single();

  if (error || !data) {
    console.error('Failed to create announcement', { projectId, error });
    return NextResponse.json({ error: error?.message || 'Failed to create announcement' }, { status: 400 });
  }

  return NextResponse.json({ announcement: data }, { status: 200 });
}

async function authorizeProjectManager(projectId: string) {
  const client = getSupabaseServerClient();

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
        { error: 'Only owner/admin can manage announcements' },
        { status: 403 },
      ),
    };
  }

  return { client, user };
}

function parseAnnouncementBody(body: unknown) {
  if (!body || typeof body !== 'object') return null;

  const rawTitle = (body as { title?: unknown }).title;
  const rawBody = (body as { body?: unknown }).body;
  const rawStatus = (body as { status?: unknown }).status;
  const rawPinned = (body as { is_pinned?: unknown }).is_pinned;
  const rawPublishedAt = (body as { published_at?: unknown }).published_at;

  if (typeof rawTitle !== 'string' || typeof rawBody !== 'string' || typeof rawStatus !== 'string') {
    return null;
  }

  const title = rawTitle.trim();
  const announcementBody = rawBody.trim();
  const status = normalizeStatus(rawStatus);

  if (!title || !announcementBody) return null;

  return {
    title,
    body: announcementBody,
    status,
    is_pinned: Boolean(rawPinned),
    published_at: status === 'published' && typeof rawPublishedAt === 'string' ? rawPublishedAt : null,
  };
}

function normalizeStatus(value: string) {
  if (value === 'published' || value === 'archived') return value;
  return 'draft';
}
