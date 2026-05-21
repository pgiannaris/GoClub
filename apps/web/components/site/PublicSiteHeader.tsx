'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import type { User } from '@supabase/supabase-js';

import { ChevronDown, Menu } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import { PublicSiteAccountMenu } from '~/components/site/PublicSiteAccountMenu';

type PublicSiteHeaderProps = {
  projectId: string;
  projectName: string;
  siteOrigin: string;
  pageKeys: string[];
  currentPageId: string;
  user: User | null;
  tasksPresent?: boolean;
  account?: {
    id: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
  theme: {
    surface: string;
    border: string;
    accent: string;
    accentText: string;
    text: string;
    mutedText: string;
    navSurface: string;
    navHover: string;
  };
};

const VISIBLE_NAV_ITEMS = 5;
const HIDDEN_PAGE_IDS = new Set(['home', 'contact']);

export function PublicSiteHeader(props: PublicSiteHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePages = props.pageKeys.filter(
    (pageId) => !HIDDEN_PAGE_IDS.has(pageId),
  );
  // Ensure 'tasks' appears as a primary tab (inserted near the end of visible items)
  const allNavPages = basePages.slice();
  if (!allNavPages.includes('tasks')) {
    const insertAt = Math.min(VISIBLE_NAV_ITEMS - 1, allNavPages.length);
    allNavPages.splice(insertAt, 0, 'tasks');
  }
  const visiblePages = allNavPages.slice(0, VISIBLE_NAV_ITEMS);
  const overflowPages = allNavPages.slice(VISIBLE_NAV_ITEMS);
  const currentSiteUrl = buildCurrentSiteUrl(
    props.siteOrigin,
    pathname,
    searchParams,
  );

  return (
    <header
      className="sticky top-0 z-20 shadow-sm backdrop-blur-md"
      style={{
        background: props.theme.surface,
        borderColor: props.theme.border,
      }}
    >
      <div className="container mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link
          href={`/site/${props.projectId}`}
          className="font-heading shrink-0 text-lg font-semibold tracking-tight md:text-xl"
          style={{ color: props.theme.accentText }}
        >
          {props.projectName}
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end lg:flex">
          <nav
            className="mr-4 flex items-center gap-1 rounded-xl px-2 py-1"
            style={{
              borderColor: props.theme.border,
              background: props.theme.navSurface,
            }}
          >
            {visiblePages.map((pageId) => (
              <HeaderLink
                key={pageId}
                href={getPageHref(props.projectId, pageId)}
                label={formatPageLabel(pageId)}
                active={props.currentPageId === pageId}
                theme={props.theme}
              />
            ))}

            {overflowPages.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)] hover:text-[var(--nav-text-hover)] focus:outline-none"
                  style={{
                    ['--nav-hover' as string]: props.theme.navHover,
                    ['--nav-text-hover' as string]: props.theme.text,
                    color: props.theme.mutedText ?? props.theme.text,
                  }}
                  type="button"
                >
                  More
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-48">
                  {overflowPages.map((pageId) => (
                    <DropdownMenuItem asChild key={pageId}>
                      <Link href={getPageHref(props.projectId, pageId)}>
                        {formatPageLabel(pageId)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {props.user ? (
            <PublicSiteAccountMenu
              projectId={props.projectId}
              user={props.user}
              account={props.account}
            />
          ) : (
            <>
              <Link
                href={getAuthHref('/auth/sign-in', currentSiteUrl)}
                className="rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-black/5"
                style={{
                  color: props.theme.text,
                  borderColor: props.theme.border,
                  background: props.theme.surface,
                }}
              >
                Sign in
              </Link>
              <Link
                href={getAuthHref('/auth/sign-up', currentSiteUrl)}
                className="rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                style={{ background: props.theme.accent }}
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          {props.user ? (
            <PublicSiteAccountMenu
              projectId={props.projectId}
              user={props.user}
              account={props.account}
            />
          ) : (
            <Link
              href={getAuthHref('/auth/sign-in', currentSiteUrl)}
              className="rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-black/5"
              style={{
                color: props.theme.text,
                borderColor: props.theme.border,
                background: props.theme.surface,
              }}
            >
              Sign in
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-black/5 focus:outline-none"
              style={{
                color: props.theme.text,
                borderColor: props.theme.border,
                background: props.theme.surface,
              }}
              type="button"
            >
              <Menu className="h-4 w-4" />
              Browse
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-56">
              {allNavPages.map((pageId) => (
                <DropdownMenuItem asChild key={pageId}>
                  <Link href={getPageHref(props.projectId, pageId)}>
                    {formatPageLabel(pageId)}
                  </Link>
                </DropdownMenuItem>
              ))}

              {!props.user ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={getAuthHref('/auth/sign-up', currentSiteUrl)}>
                      Create account
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function HeaderLink(props: {
  href: string;
  label: string;
  active: boolean;
  theme: PublicSiteHeaderProps['theme'];
}) {
  return (
    <Link
      href={props.href}
      className="rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)] hover:text-[var(--nav-text-hover)]"
      style={
        props.active
          ? {
              background: props.theme.accent,
              color: 'white',
            }
          : {
              ['--nav-hover' as string]: props.theme.navHover,
              ['--nav-text-hover' as string]: props.theme.text,
              color: props.theme.mutedText,
            }
      }
    >
      {props.label}
    </Link>
  );
}

function getPageHref(projectId: string, pageId: string) {
  if (pageId === 'home') return `/site/${projectId}`;
  if (pageId === 'tasks') return getTasksHref(projectId);
  return `/site/${projectId}?page=${encodeURIComponent(pageId)}`;
}

function getTasksHref(projectId: string) {
  return `/site/${projectId}/tasks`;
}

function formatPageLabel(pageId: string) {
  return pageId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildCurrentSiteUrl(
  siteOrigin: string,
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  const currentPath = pathname?.trim() || '/';
  const query = searchParams?.toString();
  const currentUrl = query ? `${currentPath}?${query}` : currentPath;

  try {
    return new URL(currentUrl, siteOrigin).toString();
  } catch {
    return currentUrl;
  }
}

function getAuthHref(path: string, next: string) {
  return `${path}?next=${encodeURIComponent(next)}`;
}
