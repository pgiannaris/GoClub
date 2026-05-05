/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getProjectPollById } from '../route';

type ProjectRouteContext = {
  params: Promise<{ id: string; pollId: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';
type PollStatus = 'draft' | 'published' | 'closed';

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { id: projectId, pollId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  if (!canManagePolls(role)) {
    return NextResponse.json(
      { error: 'Only owner/admin can manage polls' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parsePollBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Valid poll data is required' }, { status: 400 });
  }

  const existingPoll = await getProjectPollById(adminClient, projectId, pollId);
  if (!existingPoll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  }

  const nextOptions = parsed.options;
  const currentOptions = [...(existingPoll.poll_options ?? [])]
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((option: any) => option.option_text);

  const optionsChanged =
    currentOptions.length !== nextOptions.length ||
    currentOptions.some((option: string, index: number) => option !== nextOptions[index]);

  if (optionsChanged && (existingPoll.total_votes ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Poll options cannot be changed after votes have been submitted' },
      { status: 400 },
    );
  }

  const { error: updateError } = await (adminClient as any)
    .from('polls')
    .update({
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      allow_public_votes: parsed.allow_public_votes,
      closes_at: parsed.closes_at,
    })
    .eq('id', pollId)
    .eq('project_id', projectId);

  if (updateError) {
    console.error('Failed to update poll', { projectId, pollId, updateError });
    return NextResponse.json(
      { error: updateError?.message || 'Failed to update poll' },
      { status: 400 },
    );
  }

  if (optionsChanged) {
    const { error: deleteError } = await (adminClient as any)
      .from('poll_options')
      .delete()
      .eq('poll_id', pollId);

    if (deleteError) {
      console.error('Failed to replace poll options', { projectId, pollId, deleteError });
      return NextResponse.json(
        { error: deleteError?.message || 'Failed to update poll options' },
        { status: 400 },
      );
    }

    const { error: insertError } = await (adminClient as any)
      .from('poll_options')
      .insert(
        nextOptions.map((optionText, index) => ({
          poll_id: pollId,
          option_text: optionText,
          position: index,
        })),
      );

    if (insertError) {
      console.error('Failed to insert replacement poll options', {
        projectId,
        pollId,
        insertError,
      });
      return NextResponse.json(
        { error: insertError?.message || 'Failed to update poll options' },
        { status: 400 },
      );
    }
  }

  const poll = await getProjectPollById(adminClient, projectId, pollId);
  if (!poll) {
    return NextResponse.json({ error: 'Failed to load updated poll' }, { status: 500 });
  }

  return NextResponse.json({ poll }, { status: 200 });
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  const { id: projectId, pollId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  if (!canManagePolls(role)) {
    return NextResponse.json(
      { error: 'Only owner/admin can manage polls' },
      { status: 403 },
    );
  }

  const existingPoll = await getProjectPollById(adminClient, projectId, pollId);
  if (!existingPoll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  }

  const { error } = await (adminClient as any)
    .from('polls')
    .delete()
    .eq('id', pollId)
    .eq('project_id', projectId);

  if (error) {
    console.error('Failed to delete poll', { projectId, pollId, error });
    return NextResponse.json(
      { error: error.message || 'Failed to delete poll' },
      { status: 400 },
    );
  }

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
    console.error('Failed to authorize project access for polls', {
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
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }

  return null;
}

function canManagePolls(role: ProjectAccessRole) {
  return role === 'owner' || role === 'admin';
}

function parsePollBody(body: unknown): {
  title: string;
  description: string | null;
  status: PollStatus;
  allow_public_votes: boolean;
  closes_at: string | null;
  options: string[];
} | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const rawTitle = (body as { title?: unknown }).title;
  const rawDescription = (body as { description?: unknown }).description;
  const rawStatus = (body as { status?: unknown }).status;
  const rawAllowPublicVotes = (body as { allow_public_votes?: unknown }).allow_public_votes;
  const rawClosesAt = (body as { closes_at?: unknown }).closes_at;
  const rawOptions = (body as { options?: unknown }).options;

  if (typeof rawTitle !== 'string' || !Array.isArray(rawOptions)) {
    return null;
  }

  const title = rawTitle.trim().slice(0, 160);
  if (!title) {
    return null;
  }

  const options = rawOptions
    .map((option) => (typeof option === 'string' ? option.trim().slice(0, 120) : ''))
    .filter(Boolean);

  const uniqueOptions = Array.from(new Set(options.map((option) => option.toLowerCase())));
  if (options.length < 2 || options.length > 8 || uniqueOptions.length !== options.length) {
    return null;
  }

  const closesAt =
    typeof rawClosesAt === 'string' && rawClosesAt.trim() ? normalizeIsoDate(rawClosesAt) : null;

  if (typeof rawClosesAt === 'string' && rawClosesAt.trim() && !closesAt) {
    return null;
  }

  return {
    title,
    description:
      typeof rawDescription === 'string'
        ? rawDescription.trim().slice(0, 3000) || null
        : null,
    status: normalizePollStatus(rawStatus),
    allow_public_votes: Boolean(rawAllowPublicVotes),
    closes_at: closesAt,
    options,
  };
}

function normalizePollStatus(value: unknown): PollStatus {
  if (value === 'published' || value === 'closed') {
    return value;
  }

  return 'draft';
}

function normalizeIsoDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}
