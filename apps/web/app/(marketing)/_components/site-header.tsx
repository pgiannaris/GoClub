import Link from 'next/link';

import type { JwtPayload } from '@supabase/supabase-js';

import { Header } from '@kit/ui/marketing';

import { AppLogo } from '~/components/app-logo';

import { SiteHeaderAccountSection } from './site-header-account-section';
import { SiteNavigation } from './site-navigation';

export function SiteHeader(props: { user?: JwtPayload | null }) {
  return (
    <Header
      className="shadow-[0_14px_32px_-18px_rgba(15,23,42,0.28)] dark:shadow-sm dark:shadow-white/20"
      logo={
        <Link
          href="/"
          aria-label="GoClub home"
          className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50 dark:hover:bg-sidebar-accent/15"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/70 ring-1 ring-border/70 transition-colors dark:bg-sidebar-accent/25 dark:ring-sidebar-border/60">
            <AppLogo
              href={null}
              width={20}
              className="h-5 w-5 shrink-0 object-contain"
            />
          </span>

          <span className="font-heading min-w-fit text-[1.4rem] font-semibold tracking-tight text-foreground/85 dark:text-white/100">
            Go
            <span className="relative text-foreground/85 transition-all duration-200 ease-out dark:text-white/100">
              Club
              <span className="absolute -bottom-0.5 left-0 h-[2px] w-full rounded-full bg-blue-500/90 transition-all duration-200 ease-out" />
            </span>
            <span className="text-foreground dark:text-white">!</span>
          </span>
        </Link>
      }
      navigation={<SiteNavigation />}
      actions={<SiteHeaderAccountSection user={props.user ?? null} />}
    />
  );
}
