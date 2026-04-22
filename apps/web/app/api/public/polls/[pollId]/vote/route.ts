import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getRequestAccessToken } from '~/lib/auth/get-request-access-token';

type PublicPollVoteRouteContext = {
  params: Promise<{ pollId: string }>;
};

export async function POST(request: Request, context: PublicPollVoteRouteContext) {
  const { pollId } = await context.params;
  const preparation = await preparePublicPollVote(pollId, request);

  if ('response' in preparation) {
    return preparation.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const optionId = parseOptionId(body);
  if (!optionId) {
    return NextResponse.json({ error: 'Valid poll option is required' }, { status: 400 });
  }

  const { adminClient, poll, account, rosterMember, user } = preparation;

  const { data: option, error: optionError } = await (adminClient as any)
    .from('poll_options')
    .select('id')
    .eq('poll_id', poll.id)
    .eq('id', optionId)
    .maybeSingle();

  if (optionError || !option) {
    return NextResponse.json({ error: 'Poll option not found' }, { status: 404 });
  }

  if (rosterMember?.id) {
    const payload = {
      option_id: optionId,
      voter_name: rosterMember.full_name ?? account?.name ?? 'Member',
      voter_email: rosterMember.email ?? account?.email ?? null,
    };

    const { data: existingVote, error: existingVoteError } = await (adminClient as any)
      .from('poll_votes')
      .select('id')
      .eq('poll_id', poll.id)
      .eq('member_id', rosterMember.id)
      .maybeSingle();

    if (existingVoteError) {
      console.error('Failed to load existing poll vote', {
        pollId,
        memberId: rosterMember.id,
        existingVoteError,
      });

      return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 });
    }

    if (existingVote?.id) {
      const { error: updateError } = await (adminClient as any)
        .from('poll_votes')
        .update(payload)
        .eq('id', existingVote.id);

      if (updateError) {
        console.error('Failed to update poll vote', {
          pollId,
          memberId: rosterMember.id,
          updateError,
        });

        return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, updated: true }, { status: 200 });
    }

    const { error: insertError } = await (adminClient as any).from('poll_votes').insert({
      poll_id: poll.id,
      option_id: optionId,
      member_id: rosterMember.id,
      voter_name: payload.voter_name,
      voter_email: payload.voter_email,
    });

    if (insertError) {
      console.error('Failed to create poll vote', {
        pollId,
        memberId: rosterMember.id,
        insertError,
      });

      return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: false }, { status: 200 });
  }

  if (!poll.allow_public_votes) {
    return NextResponse.json(
      {
        error: user
          ? 'Your account is signed in, but it is not linked to the student roster for this club yet'
          : 'You must be signed in with a roster-linked account to vote on this poll',
      },
      { status: 403 },
    );
  }

  const { error: insertError } = await (adminClient as any).from('poll_votes').insert({
    poll_id: poll.id,
    option_id: optionId,
    voter_name: account?.name ?? null,
    voter_email: account?.email ?? null,
  });

  if (insertError) {
    console.error('Failed to create public poll vote', {
      pollId,
      insertError,
    });

    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: false }, { status: 200 });
}

async function preparePublicPollVote(pollId: string, request: Request) {
  const adminClient = getSupabaseServerAdminClient();
  const client = getSupabaseServerClient();
  const accessToken = getRequestAccessToken(request);
  const {
    data: { user: cookieUser },
  } = await client.auth.getUser();

  const fallbackAuth = !cookieUser && accessToken
    ? await adminClient.auth.getUser(accessToken)
    : null;
  const user = cookieUser ?? fallbackAuth?.data.user ?? null;

  const { data: poll, error: pollError } = await (adminClient as any)
    .from('polls')
    .select('id, project_id, status, allow_public_votes, closes_at')
    .eq('id', pollId)
    .maybeSingle();

  if (pollError || !poll) {
    return {
      response: NextResponse.json({ error: 'Poll not found' }, { status: 404 }),
    };
  }

  if (poll.status !== 'published') {
    return {
      response: NextResponse.json({ error: 'This poll is not open' }, { status: 403 }),
    };
  }

  if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) {
    return {
      response: NextResponse.json({ error: 'This poll is closed' }, { status: 403 }),
    };
  }

  if (!user && !poll.allow_public_votes) {
    return {
      response: NextResponse.json(
        { error: 'You must be signed in with a roster-linked account to vote on this poll' },
        { status: 403 },
      ),
    };
  }

  const { data: account } = user
    ? await (adminClient as any)
        .from('accounts')
        .select('id, name, email')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: rosterMember } = user
    ? await (adminClient as any)
        .from('member_profiles')
        .select('id, full_name, email')
        .eq('project_id', poll.project_id)
        .eq('account_id', user.id)
        .maybeSingle()
    : { data: null };

  return {
    adminClient,
    poll,
    user,
    account,
    rosterMember,
  };
}

function parseOptionId(body: unknown) {
  if (!body || typeof body !== 'object') {
    return '';
  }

  const rawOptionId = (body as { optionId?: unknown }).optionId;
  return typeof rawOptionId === 'string' ? rawOptionId.trim() : '';
}
