'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { JwtPayload } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarNavigation,
  useSidebar,
} from '@kit/ui/shadcn-sidebar';
import type { SidebarConfig } from '@kit/ui/sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { getNavigationConfig } from '~/config/navigation.config';
import { Tables } from '~/lib/database.types';

export function HomeSidebar(props: {
  account?: Tables<'accounts'>;
  user: JwtPayload;
  config?: SidebarConfig;
}) {
  const { open, setOpen } = useSidebar();
  const pathname = usePathname();
  const baseConfig = props.config ?? getNavigationConfig(pathname);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [pendingAccessRequestsCount, setPendingAccessRequestsCount] =
    useState(0);
  const supabase = useSupabase();

  const projectId = useMemo(() => {
    const match = pathname?.match(/\/projects\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      setPendingAccessRequestsCount(0);
      return;
    }

    const loadPendingAccessRequests = async () => {
      console.log('[HomeSidebar] pending access check started', {
        projectId,
        pathname,
      });

      const { data: requestedRows, error: requestedError } = await (supabase as any)
        .from('project_site_users')
        .select('account_id')
        .eq('project_id', projectId)
        .eq('intent', 'student-member-requested');

      if (cancelled) return;
      if (requestedError) {
        console.error('[HomeSidebar] failed loading requested rows', requestedError);
        setPendingAccessRequestsCount(0);
        return;
      }

      console.log('[HomeSidebar] requested rows', {
        count: requestedRows?.length ?? 0,
        rows: requestedRows,
      });

      const requestedAccountIds = new Set(
        ((requestedRows ?? []) as Array<{ account_id: string | null }>)
          .map((row) => row.account_id)
          .filter((value): value is string => Boolean(value)),
      );

      if (requestedAccountIds.size === 0) {
        console.log('[HomeSidebar] no requested account ids');
        setPendingAccessRequestsCount(0);
        return;
      }

      const { data: rosterRows, error: rosterError } = await (supabase as any)
        .from('member_profiles')
        .select('account_id')
        .eq('project_id', projectId)
        .in('account_id', Array.from(requestedAccountIds));

      if (cancelled) return;
      if (rosterError) {
        console.error('[HomeSidebar] failed loading roster rows', rosterError);
        setPendingAccessRequestsCount(0);
        return;
      }

      console.log('[HomeSidebar] roster rows matching requested accounts', {
        count: rosterRows?.length ?? 0,
        rows: rosterRows,
      });

      const rosterAccountIds = new Set(
        ((rosterRows ?? []) as Array<{ account_id: string | null }>)
          .map((row) => row.account_id)
          .filter((value): value is string => Boolean(value)),
      );

      const pendingCount = Array.from(requestedAccountIds).filter(
        (accountId) => !rosterAccountIds.has(accountId),
      ).length;

      console.log('[HomeSidebar] pending access result', {
        requestedAccountIds: Array.from(requestedAccountIds),
        rosterAccountIds: Array.from(rosterAccountIds),
        pendingCount,
      });

      setPendingAccessRequestsCount(pendingCount);
    };

    void loadPendingAccessRequests();

    return () => {
      cancelled = true;
    };
  }, [projectId, supabase]);

  const config = useMemo(() => {
    const routes = baseConfig.routes.map((route) => {
      if (!('children' in route)) return route;

      return {
        ...route,
        children: route.children.map((child) => {
          if (child.label !== 'Members') return child;

          return {
            ...child,
            renderAction:
              pendingAccessRequestsCount > 0 ? (
                <span className="animate-in fade-in zoom-in-75 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white duration-700">
                  {pendingAccessRequestsCount}
                </span>
              ) : null,
          };
        }),
      };
    });

    return {
      ...baseConfig,
      routes,
    };
  }, [baseConfig, pendingAccessRequestsCount]);

  return (
    <Sidebar collapsible={'icon'} lockOpen={isAccountMenuOpen} overlayDesktop>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:!text-sidebar-foreground hover:!bg-transparent hover:!shadow-none"
            >
              <Link className="flex items-center" href="/">
                <span
                  data-sidebar="menu-icon"
                  className="bg-muted/70 ring-border/70 dark:bg-sidebar-accent/25 dark:ring-sidebar-border/60 mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 transition-colors"
                >
                  <AppLogo
                    href={null}
                    width={20}
                    variant={open ? 'open' : 'closed'}
                    className={'h-5 w-5 shrink-0 object-contain'}
                  />
                </span>

                <span className="font-heading text-foreground/85 min-w-fit text-[1.4rem] font-semibold tracking-tight dark:text-white/100">
                  Go
                  <span
                    className={`text-foreground/85 relative transition-all duration-200 ease-out dark:text-white/100`}
                  >
                    Club
                    <span
                      className={`absolute -bottom-0.5 left-0 h-[2px] rounded-full bg-blue-500/90 transition-all duration-200 ease-out ${open ? 'w-full' : 'w-0'}`}
                    />
                  </span>
                  <span className="text-foreground dark:text-white">!</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="bg-sidebar-border/40 mx-auto mt-2 h-px w-9/12" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavigation config={config} />
      </SidebarContent>

      <SidebarFooter>
        <ProfileAccountDropdownContainer
          user={props.user}
          account={props.account}
          sidebarStyle
          onMenuOpenChange={(isOpen) => {
            setIsAccountMenuOpen(isOpen);
            setOpen(isOpen);
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
