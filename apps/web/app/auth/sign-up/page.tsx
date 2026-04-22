import Link from 'next/link';
import { headers } from 'next/headers';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { getAuthHomePath, getRequestHostname } from '~/lib/auth/get-auth-home-path';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signUp'),
  };
};

async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requestHeaders = await headers();
  const { next } = await searchParams;
  const paths = {
    callback: pathsConfig.auth.callback,
    appHome: getAuthHomePath(getRequestHostname(requestHeaders)),
  };

  return (
    <>
      <Heading level={5} className={'tracking-tight'}>
        <Trans i18nKey={'auth:signUpHeading'} />
      </Heading>

      <SignUpMethodsContainer
        providers={authConfig.providers}
        displayTermsCheckbox={authConfig.displayTermsCheckbox}
        paths={paths}
      />

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link href={getAuthLink(pathsConfig.auth.signIn, next)}>
            <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
          </Link>
        </Button>
      </div>
    </>
  );
}

function getAuthLink(path: string, next?: string) {
  if (!next) {
    return path;
  }

  return `${path}?next=${encodeURIComponent(next)}`;
}

export default withI18n(SignUpPage);
