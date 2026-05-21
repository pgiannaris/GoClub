import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

type SiteUserIntent =
  | 'student-member'
  | 'student-member-requested'
  | 'administrator'
  | 'just-visiting';

export async function GET(_request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectRosterManager(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient } = authorization;

  const [
    { data: rosterRows, error: rosterError },
    { data: accountRows, error: accountError },
    { data: siteUserRows, error: siteUserError },
  ] =
    await Promise.all([
      (adminClient as any)
        .from('member_profiles')
        .select('account_id')
        .eq('project_id', projectId),
      (adminClient as any)
        .from('accounts')
        .select('id, name, email'),
      (adminClient as any)
        .from('project_site_users')
        .select('account_id, intent, created_at, updated_at')
        .eq('project_id', projectId),
    ]);

  if (rosterError || accountError || siteUserError) {
    console.error('Failed to load website accounts for roster', {
      projectId,
      rosterError,
      accountError,
      siteUserError,
    });

    return NextResponse.json(
      { error: 'Failed to load website accounts for this club' },
      { status: 500 },
    );
  }

  const rosterAccountIds = new Set(
    ((rosterRows ?? []) as Array<{ account_id: string | null }>)
      .map((row) => row.account_id)
      .filter((value): value is string => Boolean(value)),
  );

  const accounts = ((accountRows ?? []) as Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>)
    .filter((account) => !rosterAccountIds.has(account.id))
    .map((account) => ({
      id: account.id,
      name: normalizeAccountName(account.name, account.email),
      email: account.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? ''));

  const accountById = new Map(
    ((accountRows ?? []) as Array<{
      id: string;
      name: string | null;
      email: string | null;
    }>).map((account) => [account.id, account]),
  );

  const siteUsers = ((siteUserRows ?? []) as Array<{
    account_id: string;
    intent: SiteUserIntent;
    created_at: string | null;
    updated_at: string | null;
  }>)
    .filter((siteUser) => !rosterAccountIds.has(siteUser.account_id))
    .map((siteUser) => {
      const account = accountById.get(siteUser.account_id);
      return {
        accountId: siteUser.account_id,
        name: normalizeAccountName(account?.name ?? null, account?.email ?? null),
        email: account?.email ?? null,
        intent: siteUser.intent,
        created_at: siteUser.created_at,
        updated_at: siteUser.updated_at,
      };
    })
    .sort(
      (a, b) =>
        siteUserSortIndex(a.intent) - siteUserSortIndex(b.intent) ||
        (b.updated_at ? new Date(b.updated_at).getTime() : 0) -
          (a.updated_at ? new Date(a.updated_at).getTime() : 0) ||
        a.name.localeCompare(b.name) ||
        (a.email ?? '').localeCompare(b.email ?? ''),
    );

  return NextResponse.json({ accounts, siteUsers }, { status: 200 });
}

export async function POST(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectRosterManager(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient } = authorization;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  console.log('POST /members/accounts body', body);

  const accountId = parseAccountId(body);
  if (!accountId) {
    return NextResponse.json({ error: 'Valid account id is required' }, { status: 400 });
  }

  const { data: existingByAccount, error: existingByAccountError } = await (adminClient as any)
    .from('member_profiles')
    .select('id, project_id, account_id, full_name, email, role, joined_at')
    .eq('project_id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (existingByAccountError) {
    return NextResponse.json({ error: 'Failed to check the student roster' }, { status: 500 });
  }

  if (existingByAccount) {
    await markSiteUserAsMember(adminClient, projectId, accountId);
    return NextResponse.json(
      { student: existingByAccount, alreadyExists: true },
      { status: 200 },
    );
  }

  const { data: account, error: accountError } = await (adminClient as any)
    .from('accounts')
    .select('id, name, email')
    .eq('id', accountId)
    .maybeSingle();

  console.log('POST /members/accounts account lookup', {
    projectId,
    accountId,
    account,
    accountError,
  });

  if (accountError) {
    console.error('Failed to load website account for roster insert', {
      projectId,
      accountId,
      accountError,
    });

    return NextResponse.json({ error: 'Failed to load that website account' }, { status: 500 });
  }

  if (!account?.id) {
    return NextResponse.json({ error: 'Website account not found' }, { status: 404 });
  }

  const normalizedEmail =
    typeof account.email === 'string' ? account.email.trim().toLowerCase() : null;

  if (normalizedEmail) {
    const { data: rosterRowsByEmail, error: existingByEmailError } = await (adminClient as any)
      .from('member_profiles')
      .select('id, project_id, account_id, full_name, email, role, joined_at')
      .eq('project_id', projectId);

    if (existingByEmailError) {
      return NextResponse.json({ error: 'Failed to check the student roster' }, { status: 500 });
    }

    const existingByEmail = ((rosterRowsByEmail ?? []) as Array<{
      id: string;
      project_id: string;
      account_id: string | null;
      full_name: string;
      email: string | null;
      role: string | null;
      joined_at: string | null;
    }>).find((row) => normalizeEmail(row.email) === normalizedEmail);

    if (existingByEmail?.id) {
      if (existingByEmail.account_id && existingByEmail.account_id !== account.id) {
        return NextResponse.json(
          { error: 'That student roster entry is already linked to a different account' },
          { status: 409 },
        );
      }

      const { data: updatedStudent, error: updateError } = await (adminClient as any)
        .from('member_profiles')
        .update({
          account_id: account.id,
          email: normalizedEmail,
        })
        .eq('id', existingByEmail.id)
        .select('id, project_id, account_id, full_name, email, role, joined_at')
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      await markSiteUserAsMember(adminClient, projectId, account.id);

      return NextResponse.json(
        { student: updatedStudent, linkedExisting: true },
        { status: 200 },
      );
    }
  }

  const { data: student, error: insertError } = await (adminClient as any)
    .from('member_profiles')
    .insert({
      project_id: projectId,
      account_id: account.id,
      full_name: normalizeAccountName(account.name, account.email),
      email: normalizedEmail,
    })
    .select('id, project_id, account_id, full_name, email, role, joined_at')
    .single();

  if (insertError) {
    if (normalizedEmail) {
      const { data: rosterRowsAfterInsert } = await (adminClient as any)
        .from('member_profiles')
        .select('id, project_id, account_id, full_name, email, role, joined_at')
        .eq('project_id', projectId);

      const duplicateByEmail = ((rosterRowsAfterInsert ?? []) as Array<{
        id: string;
        project_id: string;
        account_id: string | null;
        full_name: string;
        email: string | null;
        role: string | null;
        joined_at: string | null;
      }>).find((row) => normalizeEmail(row.email) === normalizedEmail);

      if (duplicateByEmail?.id && (!duplicateByEmail.account_id || duplicateByEmail.account_id === account.id)) {
        const { data: updatedStudent, error: updateError } = await (adminClient as any)
          .from('member_profiles')
          .update({
            account_id: account.id,
            email: normalizedEmail,
          })
          .eq('id', duplicateByEmail.id)
          .select('id, project_id, account_id, full_name, email, role, joined_at')
          .single();

        if (!updateError && updatedStudent) {
          await markSiteUserAsMember(adminClient, projectId, account.id);
          return NextResponse.json(
            { student: updatedStudent, linkedExisting: true },
            { status: 200 },
          );
        }
      }
    }

    console.error('Failed to insert student roster entry', {
      projectId,
      accountId,
      normalizedEmail,
      insertError,
    });

    return NextResponse.json(
      {
        error:
          insertError.details ||
          insertError.hint ||
          insertError.message ||
          'Failed to create student profile',
      },
      { status: 400 },
    );
  }

  await markSiteUserAsMember(adminClient, projectId, account.id);
  return NextResponse.json({ student }, { status: 200 });
}

async function authorizeProjectRosterManager(projectId: string) {
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
  let canManageRoster = isOwner;

  if (!canManageRoster) {
    const { data: selfMember } = await (client as any)
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('account_id', user.id)
      .maybeSingle();

    canManageRoster = selfMember?.role === 'owner' || selfMember?.role === 'admin';
  }

  if (!canManageRoster) {
    return {
      response: NextResponse.json(
        { error: 'Only owner/admin can manage the student roster' },
        { status: 403 },
      ),
    };
  }

  return { adminClient, user };
}

function parseAccountId(body: unknown) {
  if (!body || typeof body !== 'object') return '';

  const raw = (body as { accountId?: unknown }).accountId;
  if (typeof raw !== 'string') return '';

  return raw.trim();
}

function normalizeAccountName(name: string | null, email: string | null) {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail.split('@')[0] || trimmedEmail;

  return 'Unnamed Student';
}

function normalizeEmail(email: string | null) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

function siteUserSortIndex(intent: SiteUserIntent) {
  if (intent === 'student-member-requested') return 0;
  if (intent === 'student-member') return 1;
  if (intent === 'administrator') return 2;
  return 3;
}

async function markSiteUserAsMember(
  adminClient: unknown,
  projectId: string,
  accountId: string,
) {
  await (adminClient as any).from('project_site_users').upsert(
    {
      project_id: projectId,
      account_id: accountId,
      intent: 'student-member',
    },
    { onConflict: 'project_id,account_id' },
  );
}
