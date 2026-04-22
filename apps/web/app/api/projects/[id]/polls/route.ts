import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';
type PollStatus = 'draft' | 'published' | 'closed';

const POLL_SELECT =
  'id, project_id, title, description, status, allow_public_votes, closes_at, created_at, created_by, poll_options(id, option_text, position)';

export async function GET(_request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;
  const polls = await getProjectPolls(adminClient, projectId);

  if ('response' in polls) {
    return polls.response;
  }

  return NextResponse.json(
    {
      polls: polls.polls,
      permissions: {
        canManage: canManagePolls(role),
      },
    },
    { status: 200 },
  );
}

export async function POST(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role, user } = authorization;

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

  const { data: poll, error: pollError } = await (adminClient as any)
    .from('polls')
    .insert({
      project_id: projectId,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      allow_public_votes: parsed.allow_public_votes,
      closes_at: parsed.closes_at,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (pollError || !poll) {
    console.error('Failed to create poll', { projectId, pollError });
    return NextResponse.json(
      { error: pollError?.message || 'Failed to create poll' },
      { status: 400 },
    );
  }

  const optionRows = parsed.options.map((optionText, index) => ({
    poll_id: poll.id,
    option_text: optionText,
    position: index,
  }));

  const { error: optionsError } = await (adminClient as any)
    .from('poll_options')
    .insert(optionRows);

  if (optionsError) {
    await (adminClient as any).from('polls').delete().eq('id', poll.id);
    console.error('Failed to create poll options', {
      projectId,
      pollId: poll.id,
      optionsError,
    });
    return NextResponse.json(
      { error: optionsError?.message || 'Failed to create poll options' },
      { status: 400 },
    );
  }

  const hydratedPoll = await getProjectPollById(adminClient, projectId, poll.id);
  if (!hydratedPoll) {
    return NextResponse.json(
      { error: 'Poll created but could not be loaded' },
      { status: 500 },
    );
  }

  return NextResponse.json({ poll: hydratedPoll }, { status: 200 });
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
    return { adminClient, user, role: 'owner' as const };
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

  return { adminClient, user, role };
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

async function getProjectPolls(adminClient: any, projectId: string) {
  const { data, error } = await (adminClient as any)
    .from('polls')
    .select(POLL_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load project polls', { projectId, error });
    return {
      response: NextResponse.json({ error: 'Failed to load polls' }, { status: 500 }),
    };
  }

  return {
    polls: await hydratePollsWithVoteCounts(adminClient, data ?? []),
  };
}

export async function getProjectPollById(
  adminClient: any,
  projectId: string,
  pollId: string,
) {
  const { data, error } = await (adminClient as any)
    .from('polls')
    .select(POLL_SELECT)
    .eq('project_id', projectId)
    .eq('id', pollId)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load project poll', { projectId, pollId, error });
    return null;
  }

  const hydrated = await hydratePollsWithVoteCounts(adminClient, [data]);
  return hydrated[0] ?? null;
}

async function hydratePollsWithVoteCounts(adminClient: any, polls: any[]) {
  const pollIds = polls.map((poll) => poll.id).filter(Boolean);
  if (pollIds.length === 0) {
    return polls;
  }

  const { data: votes, error } = await (adminClient as any)
    .from('poll_votes')
    .select('poll_id, option_id')
    .in('poll_id', pollIds);

  if (error) {
    console.error('Failed to load poll votes', { pollIds, error });
  }

  const votesByOptionId = new Map<string, number>();
  const totalsByPollId = new Map<string, number>();

  for (const vote of votes ?? []) {
    votesByOptionId.set(vote.option_id, (votesByOptionId.get(vote.option_id) ?? 0) + 1);
    totalsByPollId.set(vote.poll_id, (totalsByPollId.get(vote.poll_id) ?? 0) + 1);
  }

  return polls.map((poll) => ({
    ...poll,
    total_votes: totalsByPollId.get(poll.id) ?? 0,
    poll_options: [...(poll.poll_options ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((option: any) => ({
        ...option,
        vote_count: votesByOptionId.get(option.id) ?? 0,
      })),
  }));
}
