'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import type { Provider } from '@supabase/supabase-js';

import { isBrowser } from '@kit/shared/utils';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';

import { MagicLinkAuthContainer } from './magic-link-auth-container';
import { OauthProviders } from './oauth-providers';
import { PasswordSignInContainer } from './password-sign-in-container';

export function SignInMethodsContainer(props: {
  paths: {
    callback: string;
    home: string;
  };

  providers: {
    password: boolean;
    magicLink: boolean;
    oAuth: Provider[];
  };
}) {
  const router = useRouter();
  const nextPath = useSearchParams().get('next') ?? props.paths.home;
  const redirectUrl = getCallbackUrl(props.paths.callback, nextPath);

  const onSignIn = () => {
    if (isExternalUrl(nextPath)) {
      window.location.assign(nextPath);
      return;
    }

    router.replace(nextPath);
  };

  return (
    <>
      <If condition={props.providers.password}>
        <PasswordSignInContainer onSignIn={onSignIn} />
      </If>

      <If condition={props.providers.magicLink}>
        <MagicLinkAuthContainer
          redirectUrl={redirectUrl}
          shouldCreateUser={false}
        />
      </If>

      <If condition={props.providers.oAuth.length}>
        <Separator />

        <OauthProviders
          enabledProviders={props.providers.oAuth}
          shouldCreateUser={false}
          paths={{
            callback: props.paths.callback,
            returnPath: nextPath,
          }}
        />
      </If>
    </>
  );
}

function getCallbackUrl(callbackPath: string, nextPath: string) {
  if (!isBrowser()) {
    return '';
  }

  const url = new URL(callbackPath, window.location.origin);

  if (nextPath) {
    url.searchParams.set('next', nextPath);
  }

  return url.toString();
}

function isExternalUrl(path: string) {
  if (!isBrowser()) {
    return false;
  }

  try {
    return new URL(path, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}
