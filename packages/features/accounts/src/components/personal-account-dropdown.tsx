'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { JwtPayload } from '@supabase/supabase-js';

import {
  ChevronsUpDown,
  Home,
  LogOut,
  UserRound,
} from 'lucide-react';

import { useUser } from '@kit/supabase/hooks/use-user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { If } from '@kit/ui/if';
import { SubMenuModeToggle } from '@kit/ui/mode-toggle';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { usePersonalAccountData } from '../hooks/use-personal-account-data';
import { getUserMetadataDisplayName } from '../utils/get-user-metadata-display-name';

function isEmailLike(value?: string | null) {
  if (!value) {
    return false;
  }

  return value.includes('@');
}

export function PersonalAccountDropdown({
  className,
  user,
  signOutRequested,
  showProfileName = true,
  sidebarStyle = false,
  onMenuOpenChange,
  paths,
  features,
  account,
}: {
  user: JwtPayload;

  account?: {
    id: string | null;
    name: string | null;
    avatar_url: string | null;
  };

  signOutRequested: () => unknown;

  paths: {
    home: string;
    profileSettings: string;
  };

  features: {
    enableThemeToggle: boolean;
  };

  showProfileName?: boolean;

  sidebarStyle?: boolean;

  onMenuOpenChange?: (open: boolean) => void;

  className?: string;
}) {
  const iconWrapperClassName =
    'mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-[color,background-color] duration-300 ease-in-out group-data-[minimized=true]:mr-0';
  const labelClassName =
    'min-w-fit flex-1 whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)]';
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const personalAccountData = usePersonalAccountData(user.id, account);

  const signedInAsLabel = useMemo(() => {
    const email = user?.email ?? undefined;
    const phone = user?.phone ?? undefined;

    return email ?? phone;
  }, [user]);

  const accountDisplayName = [
    personalAccountData?.data?.name,
    account?.name,
  ].find((value) => typeof value === 'string' && value.trim() && !isEmailLike(value));

  const displayName =
    accountDisplayName?.trim() ??
    getUserMetadataDisplayName(user) ??
    user?.email ??
    '';

  const { data: userProfileDetailed, isPending } = useUser();
  const userProfileAvatarUrl = userProfileDetailed?.user_metadata?.avatar_url;
  return (
    <DropdownMenu
      open={isMenuOpen}
      onOpenChange={(open) => {
        setIsMenuOpen(open);
        onMenuOpenChange?.(open);
      }}
    >
      <DropdownMenuTrigger
        aria-label="Open your profile menu"
        data-test={'account-dropdown-trigger'}
        className={cn(
          'animate-in fade-in flex cursor-pointer items-center duration-500 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 group-data-[minimized=true]:px-0',
          sidebarStyle &&
            'w-full rounded-md p-2 text-left text-sm transition-colors hover:bg-sidebar-accent/40 active:text-sidebar-accent-foreground group-data-[minimized=true]:justify-center',
          className ?? '',
          {
            ['active:bg-secondary/50 items-center gap-x-4 rounded-md' +
            ' hover:bg-secondary p-2 transition-colors']: showProfileName,
          },
        )}
      >
        <span data-sidebar="menu-icon" className={iconWrapperClassName}>
          <ProfileAvatar
            className={'h-9 w-9 rounded-md'}
            fallbackClassName={'h-9 w-9 rounded-md border'}
            displayName={displayName ?? user?.email ?? ''}
            pictureUrl={userProfileAvatarUrl}
          />
        </span>

        <If condition={showProfileName}>
          <div
            className={
              cn(
                'fade-in animate-in flex w-full flex-col truncate text-left group-data-[minimized=true]:hidden',
                labelClassName,
              )
            }
          >
            <span
              data-test={'account-dropdown-display-name'}
              className={'truncate text-sm'}
            >
              {displayName}
            </span>

            <span
              data-test={'account-dropdown-email'}
              className={'text-muted-foreground truncate text-xs'}
            >
              {signedInAsLabel}
            </span>
          </div>

          <ChevronsUpDown
            className={
              'text-muted-foreground mr-1 h-8 group-data-[minimized=true]:hidden'
            }
          />
        </If>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={'xl:!min-w-[13rem]'}>
        <DropdownMenuItem className={'!h-10 rounded-none'}>
          <div
            className={'flex flex-col justify-start truncate text-left text-xs'}
          >
            <div className={'text-muted-foreground'}>
              <Trans i18nKey={'common:signedInAs'} />
            </div>

            <div>
              <span className={'block truncate'}>{signedInAsLabel}</span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            className={'s-full flex cursor-pointer items-center space-x-2'}
            href={paths.home}
          >
            <Home className={'h-5'} />

            <span>
              <Trans i18nKey={'common:routes.home'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            className={'s-full flex cursor-pointer items-center space-x-2'}
            href={paths.profileSettings}
          >
            <UserRound className={'h-5'} />

            <span>
              <Trans i18nKey={'common:routes.profile'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <If condition={features.enableThemeToggle}>
          <SubMenuModeToggle />
        </If>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          data-test={'account-dropdown-sign-out'}
          role={'button'}
          className={'cursor-pointer'}
          onClick={signOutRequested}
        >
          <span className={'flex w-full items-center space-x-2'}>
            <LogOut className={'h-5'} />

            <span>
              <Trans i18nKey={'auth:signOut'} />
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
