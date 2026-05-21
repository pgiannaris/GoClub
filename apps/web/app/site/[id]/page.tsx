import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PollVoteForm } from '~/components/site/PollVoteForm';
import { PublicEventsCalendar } from '~/components/site/PublicEventsCalendar';
import { PublicSiteHeader } from '~/components/site/PublicSiteHeader';
import { PublicSiteRolePrompt } from '~/components/site/PublicSiteRolePrompt';
import { PublicSiteThemeSync } from '~/components/site/PublicSiteThemeSync';
import {
  type Block,
  type PageSettings,
  type SiteContent,
  type SiteSettings,
  getPageSpacingStyle,
  getSiteTheme,
  resolvePageSettings,
  resolveSiteSettings,
} from '~/lib/site-content';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const formatPageLabel = (pageId: string) =>
  pageId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single();

  return {
    title: project?.name || 'Club Website',
  };
}

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = getSupabaseServerAdminClient();
  const authClient = getSupabaseServerClient();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const themePreference = cookieStore.get('theme')?.value;
  const resolvedTheme = cookieStore.get('resolved-theme')?.value;
  const siteOrigin = getRequestOrigin(requestHeaders);
  const isDark =
    themePreference === 'dark' ||
    ((themePreference === 'system' || !themePreference) &&
      resolvedTheme === 'dark');

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, content')
    .eq('id', id)
    .single();

  if (error || !project) {
    return notFound();
  }

  const content = (project.content as SiteContent) || { pages: {} };
  const pages = content.pages || {};
  const pageKeys = Object.keys(pages);
  const requestedPage = resolvedSearchParams.page || 'home';
  const currentPageId = pages[requestedPage]
    ? requestedPage
    : pageKeys[0] || 'home';
  const blocks = pages[currentPageId] || [];
  const siteSettings = resolveSiteSettings(content.siteSettings);
  const pageSettings = resolvePageSettings(
    content.pageSettings?.[currentPageId],
  );
  const theme = getSiteTheme(siteSettings, pageSettings, { isDark });

  const {
    data: { user },
  } = await authClient.auth.getUser();

  const { data: account } = user
    ? await (authClient as any)
        .from('accounts')
        .select('id, name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: rosterMember } = user
    ? await (adminClient as any)
        .from('member_profiles')
        .select('id')
        .eq('project_id', id)
        .eq('account_id', user.id)
        .maybeSingle()
    : { data: null };

  const [
    { data: announcements },
    { data: events },
    { data: members },
    { data: polls },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from('announcements')
      .select('id,title,body,published_at,is_pinned,tags')
      .eq('project_id', id)
      .eq('status', 'published')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('events')
      .select(
        'id,title,description,start_at,end_at,location,rsvp_url,status,visibility',
      )
      .eq('project_id', id)
      .eq('visibility', 'public')
      .order('start_at', { ascending: true })
      .limit(50),
    supabase
      .from('member_profiles')
      .select('id,full_name,role,avatar_url,bio,tags,joined_at')
      .eq('project_id', id)
      .eq('is_public', true)
      .order('joined_at', { ascending: false })
      .limit(100),
    supabase
      .from('polls')
      .select(
        'id,title,description,closes_at,allow_public_votes,status,poll_options(id,option_text,position)',
      )
      .eq('project_id', id)
      .eq('status', 'published')
      .order('closes_at', { ascending: true })
      .limit(20),
    supabase
      .from('tasks')
      .select('id,title,status,priority,due_date')
      .eq('project_id', id)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <div
      className="min-h-screen overflow-x-hidden font-sans"
      style={{ background: theme.pageBackground }}
    >
      <PublicSiteThemeSync />
      {user ? <PublicSiteRolePrompt projectId={id} userId={user.id} /> : null}

      <PublicSiteHeader
        projectId={id}
        projectName={project.name}
        siteOrigin={siteOrigin}
        pageKeys={pageKeys}
        currentPageId={currentPageId}
        user={user}
        account={account}
        tasksPresent={Boolean(tasks && tasks.length)}
        theme={theme}
      />

      <main className="min-h-[calc(100vh-64px-160px)]">
        {pageSettings.showPageHeader && (
          <PageIntroHeader
            pageLabel={formatPageLabel(currentPageId)}
            intro={pageSettings.intro}
            theme={theme}
          />
        )}
        {blocks.length === 0 ? (
          <div className="text-muted-foreground py-20 text-center">
            <h2 className="mb-2 text-2xl font-bold">Page Not Found or Empty</h2>
            <p>This page has no content yet.</p>
          </div>
        ) : (
          blocks.map((block) => (
            <PublicBlockRenderer
              key={block.id}
              block={block}
              pageSettings={pageSettings}
              siteSettings={siteSettings}
              theme={theme}
              viewer={{
                isAuthenticated: Boolean(user),
                isRosterMember: Boolean(rosterMember?.id),
                responderName: account?.name ?? null,
              }}
              data={{
                announcements: announcements || [],
                events: events || [],
                members: members || [],
                polls: polls || [],
                sessions: [],
                tasks: tasks || [],
              }}
            />
          ))
        )}
      </main>

      <footer
        className="mt-20 py-12"
        style={{ background: theme.footerBackground, color: theme.footerText }}
      >
        <div className="container mx-auto max-w-6xl px-4 text-center md:px-8">
          <p>
            &copy; {new Date().getFullYear()} {project.name}. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function getRequestOrigin(headersStore: Headers) {
  const host =
    headersStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headersStore.get('host')?.trim();

  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }

  const protocol =
    headersStore.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

function PageIntroHeader({
  pageLabel,
  intro,
  theme,
}: {
  pageLabel: string;
  intro: string;
  theme: ReturnType<typeof getSiteTheme>;
}) {
  return (
    <section
      className="px-4 py-14 md:py-16"
      style={{
        background: `linear-gradient(135deg, ${theme.accentMuted}, rgba(255,255,255,0.95))`,
      }}
    >
      <div className="container mx-auto max-w-5xl">
        <h1
          className="font-heading text-3xl font-semibold md:text-5xl"
          style={{ color: theme.cardText }}
        >
          {pageLabel}
        </h1>
        {intro ? (
          <p
            className="mt-4 max-w-3xl text-base leading-7 md:text-lg"
            style={{ color: theme.mutedText }}
          >
            {intro}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PublicBlockRenderer({
  block,
  pageSettings,
  siteSettings,
  theme,
  viewer,
  data,
}: {
  block: Block;
  pageSettings: PageSettings;
  siteSettings: SiteSettings;
  theme: ReturnType<typeof getSiteTheme>;
  viewer: {
    isAuthenticated: boolean;
    isRosterMember: boolean;
    responderName: string | null;
  };
  data: {
    announcements: any[];
    events: any[];
    members: any[];
    polls: any[];
    sessions: any[];
    tasks: any[];
  };
}) {
  const settings = block.settings || {};
  const sectionStyle = getPageSpacingStyle(pageSettings);
  const cardStyle = {
    background: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  };
  const elevatedCardStyle = {
    ...cardStyle,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
  };
  const hoverCardClassName =
    'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]';
  const tintedSectionStyle = {
    ...sectionStyle,
    background: theme.accentMuted,
  };
  const sectionHeader = (title: string, count: string) => (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2
          className="font-heading text-3xl font-semibold"
          style={{ color: theme.cardText }}
        >
          {title}
        </h2>
      </div>
      <span className="text-sm" style={{ color: theme.mutedText }}>
        {count}
      </span>
    </header>
  );

  switch (block.type) {
    case 'hero':
      return (
        <section className="px-4" style={sectionStyle}>
          <div
            className={`container mx-auto max-w-5xl border px-6 py-16 md:px-10 md:py-20 ${
              siteSettings.heroAlign === 'left' ? 'text-left' : 'text-center'
            }`}
            style={{
              ...elevatedCardStyle,
            }}
          >
            <h1
              className="font-heading mb-6 text-4xl font-semibold md:text-6xl"
              style={{ color: theme.cardText }}
            >
              {block.content.title}
            </h1>
            <p
              className={`mb-10 text-lg leading-relaxed md:text-xl ${
                siteSettings.heroAlign === 'left'
                  ? 'max-w-3xl'
                  : 'mx-auto max-w-3xl'
              }`}
              style={{ color: theme.mutedText }}
            >
              {block.content.subtitle}
            </p>
            <div
              className={`flex flex-wrap gap-3 ${
                siteSettings.heroAlign === 'left'
                  ? 'justify-start'
                  : 'justify-center'
              }`}
            >
              <a
                className="rounded-lg px-7 py-3 font-semibold text-white shadow-sm transition-all"
                style={{ background: theme.accent }}
                href="#events"
              >
                View Events
              </a>
              <a
                className="rounded-lg border px-7 py-3 font-semibold shadow-sm transition-all"
                style={{
                  background: theme.surface,
                  borderColor: theme.border,
                  borderRadius: '0.5rem',
                }}
                href="#contact"
              >
                Contact
              </a>
            </div>
          </div>
        </section>
      );

    case 'text':
      return (
        <section className="px-4" style={sectionStyle}>
          <div className="container mx-auto max-w-3xl">
            <div
              className="prose prose-lg mx-auto"
              style={{ color: theme.text }}
            >
              <p className="whitespace-pre-wrap">{block.content.text}</p>
            </div>
          </div>
        </section>
      );

    case 'image': {
      const imageUrl =
        typeof block.content?.imageUrl === 'string'
          ? block.content.imageUrl
          : null;
      const altText =
        typeof block.content?.altText === 'string' ? block.content.altText : '';
      const caption =
        typeof block.content?.caption === 'string' ? block.content.caption : '';

      return (
        <section className="px-4" style={sectionStyle}>
          <div className="container mx-auto max-w-5xl">
            {imageUrl ? (
              <figure
                className={`overflow-hidden border ${hoverCardClassName}`}
                style={elevatedCardStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={altText || caption || 'Site image'}
                  className="h-auto w-full object-cover"
                />
                {caption || altText ? (
                  <figcaption
                    className="border-t px-5 py-4 text-sm"
                    style={{
                      borderColor: theme.border,
                      color: theme.mutedText,
                      background: theme.surface,
                    }}
                  >
                    {caption || altText}
                  </figcaption>
                ) : null}
              </figure>
            ) : (
              <EmptyState message="No image uploaded yet" theme={theme} />
            )}
          </div>
        </section>
      );
    }

    case 'features':
      return (
        <section className="px-4" id="about" style={tintedSectionStyle}>
          <div className="container mx-auto max-w-6xl">
            <div className="grid gap-8 md:grid-cols-3">
              {(Array.isArray(block.content?.items)
                ? block.content.items
                : []
              ).map((item: any, i: number) => {
                const title =
                  typeof item === 'string'
                    ? item
                    : typeof item?.title === 'string'
                      ? item.title
                      : `Feature ${i + 1}`;
                const description =
                  typeof item?.description === 'string'
                    ? item.description
                    : 'Curated resources, programming, and leadership support tailored to your club.';

                return (
                  <div
                    key={i}
                    className={`border p-8 ${hoverCardClassName}`}
                    style={elevatedCardStyle}
                  >
                    <div
                      className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold"
                      style={{
                        background: theme.accentSoft,
                        color: theme.accentText,
                      }}
                    >
                      {i + 1}
                    </div>
                    <h3
                      className="font-heading mb-3 text-xl font-semibold"
                      style={{ color: theme.cardText }}
                    >
                      {title}
                    </h3>
                    <p
                      className="leading-relaxed"
                      style={{ color: theme.mutedText }}
                    >
                      {description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );

    case 'announcements': {
      const items = (data.announcements || []).slice(0, settings.limit || 6);
      return (
        <section className="px-4" id="announcements" style={sectionStyle}>
          <div className="container mx-auto max-w-6xl">
            {sectionHeader(
              'Announcements',
              `${items.length} update${items.length === 1 ? '' : 's'}`,
            )}
            {items.length === 0 ? (
              <EmptyState message="No announcements yet" theme={theme} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((post: any) => (
                  <article
                    key={post.id}
                    className={`border p-5 ${hoverCardClassName}`}
                    style={elevatedCardStyle}
                  >
                    <div
                      className="mb-2 flex items-center gap-2 text-xs"
                      style={{ color: theme.mutedText }}
                    >
                      <span
                        className="rounded-full px-2 py-1 font-semibold"
                        style={{
                          background: theme.accentSoft,
                          color: theme.accentText,
                        }}
                      >
                        {post.is_pinned ? 'Pinned' : 'Update'}
                      </span>
                      <span>
                        {new Date(post.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3
                      className="font-heading text-lg font-semibold"
                      style={{ color: theme.cardText }}
                    >
                      {post.title}
                    </h3>
                    <p
                      className="mt-2 line-clamp-3 text-sm"
                      style={{ color: theme.mutedText }}
                    >
                      {post.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'events': {
      const allItems = data.events || [];
      const items = allItems.slice(0, settings.limit || 6);
      return (
        <section className="px-4" id="events" style={tintedSectionStyle}>
          <div className="container mx-auto max-w-6xl">
            {sectionHeader(
              'Upcoming Events',
              `${allItems.length} event${allItems.length === 1 ? '' : 's'}`,
            )}
            {items.length === 0 ? (
              <EmptyState message="No events scheduled" theme={theme} />
            ) : (
              <div className="space-y-6">
                <PublicEventsCalendar
                  events={items}
                  allEvents={allItems}
                  theme={theme}
                  showRsvp={Boolean(settings.showRsvp)}
                  isAuthenticated={viewer.isAuthenticated}
                  defaultResponderName={viewer.responderName}
                />
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'members': {
      const items = (data.members || []).slice(0, settings.limit || 12);
      const isGrid = (settings.layout || 'grid') === 'grid';
      return (
        <section className="px-4" id="members" style={sectionStyle}>
          <div className="container mx-auto max-w-6xl">
            {sectionHeader(
              'Members',
              `${items.length} member${items.length === 1 ? '' : 's'}`,
            )}
            {items.length === 0 ? (
              <EmptyState message="No public members yet" theme={theme} />
            ) : (
              <div
                className={
                  isGrid
                    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'space-y-3'
                }
              >
                {items.map((member: any) => (
                  <div
                    key={member.id}
                    className={`flex items-start gap-4 border p-4 ${hoverCardClassName}`}
                    style={elevatedCardStyle}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full font-bold"
                      style={{
                        background: theme.accentSoft,
                        color: theme.accentText,
                      }}
                    >
                      {member.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className="font-heading font-semibold"
                          style={{ color: theme.cardText }}
                        >
                          {member.full_name}
                        </p>
                        {member.role && (
                          <span
                            className="rounded-full px-2 py-1 text-xs"
                            style={{
                              background: theme.chipSurface,
                              color: theme.text,
                            }}
                          >
                            {member.role}
                          </span>
                        )}
                      </div>
                      {member.bio && (
                        <p
                          className="mt-1 line-clamp-2 text-sm"
                          style={{ color: theme.mutedText }}
                        >
                          {member.bio}
                        </p>
                      )}
                      {member.tags && member.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {member.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="rounded-full px-2 py-1 text-xs"
                              style={{
                                background: theme.accentMuted,
                                color: theme.accentText,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'polls': {
      const items = (data.polls || []).slice(0, settings.limit || 3);
      return (
        <section className="px-4" id="polls" style={tintedSectionStyle}>
          <div className="container mx-auto max-w-6xl">
            {sectionHeader(
              'Polls',
              `${items.length} poll${items.length === 1 ? '' : 's'}`,
            )}
            {items.length === 0 ? (
              <EmptyState message="No active polls" theme={theme} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((poll: any) => {
                  const canVote =
                    Boolean(settings.allowVoting) &&
                    (poll.allow_public_votes || viewer.isRosterMember) &&
                    (poll.poll_options?.length ?? 0) > 0;

                  return (
                    <div
                      key={poll.id}
                      className={`space-y-3 border p-5 ${hoverCardClassName}`}
                      style={elevatedCardStyle}
                    >
                      <div
                        className="flex items-center justify-between text-xs"
                        style={{ color: theme.mutedText }}
                      >
                        <span
                          className="rounded-full px-2 py-1 font-semibold"
                          style={{
                            background: theme.accentSoft,
                            color: theme.accentText,
                          }}
                        >
                          {poll.status === 'published' ? 'Open' : poll.status}
                        </span>
                        {poll.closes_at && (
                          <span>
                            Closes{' '}
                            {new Date(poll.closes_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3
                        className="font-heading text-lg font-semibold"
                        style={{ color: theme.cardText }}
                      >
                        {poll.title}
                      </h3>
                      {poll.description && (
                        <p
                          className="text-sm"
                          style={{ color: theme.mutedText }}
                        >
                          {poll.description}
                        </p>
                      )}
                      {canVote ? (
                        <PollVoteForm
                          pollId={poll.id}
                          options={poll.poll_options}
                        />
                      ) : (
                        <>
                          <ul
                            className="space-y-1 text-sm"
                            style={{ color: theme.mutedText }}
                          >
                            {poll.poll_options?.map((opt: any) => (
                              <li
                                key={opt.id}
                                className="flex items-center gap-2"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: theme.accent }}
                                />
                                {opt.option_text}
                              </li>
                            ))}
                          </ul>
                          {settings.allowVoting &&
                          !poll.allow_public_votes &&
                          !viewer.isRosterMember ? (
                            <p
                              className="text-xs"
                              style={{ color: theme.mutedText }}
                            >
                              Sign in with a roster-linked account to vote on
                              this poll.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'attendance':
      return null;

    case 'tasks': {
      const items = (data.tasks || []).slice(0, settings.limit || 6);
      return (
        <section className="px-4" id="tasks" style={tintedSectionStyle}>
          <div className="container mx-auto max-w-6xl">
            {sectionHeader(
              'Tasks',
              `${items.length} task${items.length === 1 ? '' : 's'}`,
            )}
            {items.length === 0 ? (
              <EmptyState message="No open tasks" theme={theme} />
            ) : (
              <div className="space-y-3">
                {items.map((task: any) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between border p-5 ${hoverCardClassName}`}
                    style={elevatedCardStyle}
                  >
                    <div>
                      <h3
                        className="font-heading text-lg font-semibold"
                        style={{ color: theme.cardText }}
                      >
                        {task.title}
                      </h3>
                      <p className="text-sm" style={{ color: theme.mutedText }}>
                        {task.due_date
                          ? `Due ${new Date(task.due_date).toLocaleDateString()}`
                          : 'No due date'}
                      </p>
                    </div>
                    {settings.showStatus && (
                      <span
                        className="rounded-full px-3 py-1 text-xs capitalize"
                        style={{
                          background: theme.accentSoft,
                          color: theme.accentText,
                        }}
                      >
                        {task.status?.replace('_', ' ') || 'todo'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}

function EmptyState({
  message,
  theme,
}: {
  message: string;
  theme: ReturnType<typeof getSiteTheme>;
}) {
  return (
    <div
      className="text-muted-foreground rounded-lg border py-10 text-center"
      style={{
        background: theme.surface,
        borderColor: theme.border,
        borderRadius: theme.radius,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
      }}
    >
      {message}
    </div>
  );
}
