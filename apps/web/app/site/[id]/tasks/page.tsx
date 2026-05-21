import { cookies, headers } from 'next/headers';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PublicSiteHeader } from '~/components/site/PublicSiteHeader';
import { PublicSiteThemeSync } from '~/components/site/PublicSiteThemeSync';
import TasksViewClient from '~/components/site/TasksViewClient';
import {
  type SiteContent,
  getSiteTheme,
  resolvePageSettings,
  resolveSiteSettings,
} from '~/lib/site-content';

export default async function SiteTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // ✅ Use adminClient for all server-side DB access — bypasses RLS safely
  const adminClient = getSupabaseServerAdminClient();
  const authClient = getSupabaseServerClient();
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const themePreference = cookieStore.get('theme')?.value;
  const resolvedTheme = cookieStore.get('resolved-theme')?.value;
  const isDark =
    themePreference === 'dark' ||
    ((themePreference === 'system' || !themePreference) &&
      resolvedTheme === 'dark');

  // ✅ Fetch project with adminClient + log errors
  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('id, name, content')
    .eq('id', id)
    .single();

  if (projectError) {
    console.error('[SiteTasksPage] Failed to fetch project:', {
      id,
      error: projectError,
    });
  }

  if (!project) return null;

  const content = (project.content as SiteContent) || { pages: {} };
  const siteSettings = resolveSiteSettings(content.siteSettings);
  const pageSettings = resolvePageSettings(content.pageSettings?.['tasks']);
  const theme = getSiteTheme(siteSettings, pageSettings, { isDark });

  // ✅ Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError) {
    console.error('[SiteTasksPage] Failed to get user:', userError);
  }

  // ✅ Fetch account using adminClient (no unsafe cast)
  let account = null;
  if (user) {
    const { data: accountData, error: accountError } = await adminClient
      .from('accounts')
      .select('id, name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (accountError) {
      console.error('[SiteTasksPage] Failed to fetch account:', accountError);
    } else {
      account = accountData;
    }
  }

  // ✅ Fetch tasks with adminClient + log errors
  const { data: tasks, error: tasksError } = await adminClient
    .from('tasks')
    .select('id, title, status, priority, due_date')
    .eq('project_id', id)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (tasksError) {
    console.error('[SiteTasksPage] Failed to fetch tasks:', {
      project_id: id,
      error: tasksError,
    });
  }

  // Determine whether current user can manage tasks (owner/admin)
  let rosterMember = null;
  if (user) {
    const { data: rm } = await adminClient
      .from('member_profiles')
      .select('id, role')
      .eq('project_id', id)
      .eq('account_id', user.id)
      .maybeSingle();
    rosterMember = rm;
  }

  const canManage = Boolean(
    user &&
      (project.owner_id === user.id ||
        rosterMember?.role === 'owner' ||
        rosterMember?.role === 'admin'),
  );

  console.log('[SiteTasksPage] Fetched tasks count:', tasks?.length ?? 0);

  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: theme.pageBackground }}
    >
      <PublicSiteThemeSync />

      <PublicSiteHeader
        projectId={id}
        projectName={project.name}
        siteOrigin={getRequestOrigin(requestHeaders)}
        pageKeys={Object.keys(content.pages || {})}
        currentPageId={'tasks'}
        user={user}
        account={account}
        tasksPresent={Boolean(tasks && tasks.length)}
        theme={theme}
      />

      <main className="container mx-auto max-w-5xl px-4 py-12">
        <h1
          className="font-heading mb-6 text-3xl font-semibold"
          style={{ color: theme.cardText }}
        >
          Tasks
        </h1>

        {/* Render client-side tasks UI (Kanban + List) */}
        {/* @ts-expect-error Server -> Client component */}
        <TasksViewClient
          tasks={tasks || []}
          projectId={id}
          canManage={canManage}
        />
      </main>
    </div>
  );
}

function getRequestOrigin(headersStore: Headers) {
  const host =
    headersStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headersStore.get('host')?.trim();
  if (!host)
    return (
      process.env.NEXT_PUBLIC_SITE_URL ?? 'https://go-club-web.vercel.app/'
    );
  const protocol =
    headersStore.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
