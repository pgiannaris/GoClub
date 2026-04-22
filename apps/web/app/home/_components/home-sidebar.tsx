'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { JwtPayload } from '@supabase/supabase-js';

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
  const config = props.config ?? getNavigationConfig(pathname);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  return (
    <Sidebar collapsible={'icon'} lockOpen={isAccountMenuOpen} overlayDesktop>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-transparent hover:text-sidebar-foreground data-[state=open]:hover:bg-transparent data-[state=open]:hover:text-sidebar-foreground"
            >
              <Link className="flex items-center" href="/">
                <span
                  data-sidebar="menu-icon"
                  className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/70 ring-1 ring-border/70 transition-colors dark:bg-sidebar-accent/25 dark:ring-sidebar-border/60"
                >
                  <AppLogo
                    href={null}
                    width={20}
                    variant={open ? 'open' : 'closed'}
                    className={'h-5 w-5 shrink-0 object-contain'}
                  />
                </span>

                <span className="font-heading min-w-fit text-[1.4rem] font-semibold tracking-tight text-foreground/85 dark:text-white/100">
                  Go
                  <span className={`relative text-foreground/85 transition-all duration-200 ease-out dark:text-white/100`}>
                    Club
                    <span className={`absolute -bottom-0.5 left-0 h-[2px] rounded-full bg-blue-500/90 transition-all duration-200 ease-out ${open ? 'w-full' : 'w-0'}`} />
                  </span>
                  <span className="text-foreground dark:text-white">!</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-auto mt-2 h-px w-9/12 bg-sidebar-border/40" />
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
