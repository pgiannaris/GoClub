'use client';

import { useEffect, useState } from 'react';

import type { JwtPayload, User } from '@supabase/supabase-js';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Button } from '@kit/ui/button';
import { Bell } from 'lucide-react';

import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const paths = {
  home: pathsConfig.app.home,
  profileSettings: pathsConfig.app.profileSettings,
};

const features = {
  enableThemeToggle: featuresFlagConfig.enableThemeToggle,
};

export function PublicSiteAccountMenu(props: {
  projectId: string;
  user: User;
  account?: {
    id: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
}) {
  const signOut = useSignOut();
  const user = useUser(props.user as unknown as JwtPayload);
  const userData = user.data ?? (props.user as unknown as JwtPayload);
  const [isMember, setIsMember] = useState(false);
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch(
          `/api/public/projects/${encodeURIComponent(props.projectId)}/site-role`,
          { credentials: 'include' },
        );
        if (!response.ok) return;

        const payload = (await response.json().catch(() => ({}))) as {
          isMember?: boolean;
          approvedNotice?: boolean;
          notifications?: string[];
        };

        if (cancelled) return;
        setIsMember(Boolean(payload.isMember));
        setShowApprovedNotice(Boolean(payload.approvedNotice));
        setNotifications(payload.notifications ?? []);
      } catch {
        if (cancelled) return;
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="relative h-9 w-9 rounded-full"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {notifications.length === 0 ? (
            <DropdownMenuItem className="text-muted-foreground text-xs">
              No notifications
            </DropdownMenuItem>
          ) : (
            notifications.map((item, index) => (
              <DropdownMenuItem key={`${item}-${index}`} className="items-start text-xs">
                {item}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PersonalAccountDropdown
        showProfileName={false}
        className={
          'rounded-full p-1 transition-colors hover:bg-black/5 [&_[data-sidebar=menu-icon]]:mr-0'
        }
        paths={paths}
        features={features}
        user={userData}
        account={props.account ?? undefined}
        membershipBadgeLabel={isMember ? 'Member' : null}
        notificationMessage={
          showApprovedNotice ? 'You have been approved.' : null
        }
        notifications={notifications}
        signOutRequested={() => signOut.mutateAsync()}
      />
    </div>
  );
}
