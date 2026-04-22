'use client';

import type { JwtPayload, User } from '@supabase/supabase-js';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';

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

  return (
    <PersonalAccountDropdown
      showProfileName={false}
      className={
        'rounded-full p-1 transition-colors hover:bg-black/5 [&_[data-sidebar=menu-icon]]:mr-0'
      }
      paths={paths}
      features={features}
      user={userData}
      account={props.account ?? undefined}
      signOutRequested={() => signOut.mutateAsync()}
    />
  );
}
