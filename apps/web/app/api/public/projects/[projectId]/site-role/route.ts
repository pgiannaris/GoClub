import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getRequestAccessToken } from '~/lib/auth/get-request-access-token';

type PublicProjectSiteRoleRouteContext = {
  params: Promise<{ projectId: string }>;
};

type SiteRoleIntent =
  | 'student-member'
  | 'student-member-requested'
  | 'administrator'
  | 'just-visiting';

export async function POST(request: Request, context: PublicProjectSiteRoleRouteContext) {
  const { projectId } = await context.params;
  const adminClient = getSupabaseServerAdminClient();
  const client = getSupabaseServerClient();
  const accessToken = getRequestAccessToken(request);

  const {
    data: { user },
    error: cookieAuthError,
  } = await client.auth.getUser();

  const fallbackAuth = !user && accessToken
    ? await adminClient.auth.getUser(accessToken)
    : null;

  const resolvedUser = user ?? fallbackAuth?.data.user ?? null;
  const authError = cookieAuthError ?? fallbackAuth?.error ?? null;

  if (authError || !resolvedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const intent = parseIntent(body);
  if (!intent) {
    return NextResponse.json({ error: 'Valid site role intent is required' }, { status: 400 });
  }

  const { data: project, error: projectError } = await (adminClient as any)
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { error: upsertError } = await (adminClient as any)
    .from('project_site_users')
    .upsert(
      {
        project_id: projectId,
        account_id: resolvedUser.id,
        intent,
      },
      {
        onConflict: 'project_id,account_id',
      },
    );

  if (upsertError) {
    console.error('Failed to save public site role intent', {
      projectId,
      userId: resolvedUser.id,
      intent,
      upsertError,
    });

    return NextResponse.json({ error: 'Failed to save site role' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function parseIntent(body: unknown): SiteRoleIntent | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const rawIntent = (body as { intent?: unknown }).intent;

  if (
    rawIntent === 'student-member' ||
    rawIntent === 'student-member-requested' ||
    rawIntent === 'administrator' ||
    rawIntent === 'just-visiting'
  ) {
    return rawIntent;
  }

  return null;
}
