'use client';

import React from 'react';

import { useUser } from '@kit/supabase/hooks/use-user';
import { Trans } from '@kit/ui/trans';

const LandingPageCTA = () => {
  const { data: user, isPending } = useUser();
  console.log(user);

  if (isPending) return <div>Dashboard</div>;
  return user ? <Trans>Dashboard</Trans> : <Trans>Get Started</Trans>;
};

export default LandingPageCTA;
