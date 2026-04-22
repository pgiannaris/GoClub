import Link from 'next/link';

import { Footer } from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import appConfig from '~/config/app.config';

export function SiteFooter() {
  return (
    <Footer
      logo={<FooterBrandLogo />}
      description={<Trans i18nKey="marketing:footerDescription" />}
      copyright={
        <Trans
          i18nKey="marketing:copyright"
          values={{
            product: appConfig.name,
            year: new Date().getFullYear(),
          }}
        />
      }
      sections={[
        {
          heading: 'Get Started',
          links: [
            {
              href: '/auth/sign-in',
              label: <Trans i18nKey="auth:signIn" />,
            },
            {
              href: '/auth/sign-up',
              label: <Trans i18nKey="auth:signUp" />,
            },
          ],
        },
        {
          heading: <Trans i18nKey="marketing:legal" />,
          links: [
            {
              href: '/terms-of-service',
              label: <Trans i18nKey="marketing:termsOfService" />,
            },
            {
              href: '/privacy-policy',
              label: <Trans i18nKey="marketing:privacyPolicy" />,
            },
            {
              href: '/cookie-policy',
              label: <Trans i18nKey="marketing:cookiePolicy" />,
            },
          ],
        },
      ]}
    />
  );
}

function FooterBrandLogo() {
  return (
    <Link
      href="/"
      aria-label="GoClub home"
      className="group inline-flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40 dark:hover:bg-sidebar-accent/15"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/70 transition-colors dark:bg-sidebar-accent/25 dark:ring-sidebar-border/60">
        <AppLogo
          href={null}
          width={20}
          className="h-6 w-6 shrink-0 object-contain"
        />
      </span>

      <span className="font-heading min-w-fit text-[1.2rem] font-semibold leading-none tracking-tight text-foreground/85 dark:text-white/90">
        Go
        <span className="relative text-foreground/85 transition-all duration-200 ease-out dark:text-white/90">
          Club
          <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full bg-blue-500/90 transition-all duration-200 ease-out group-hover:w-full group-focus-visible:w-full" />
        </span>
        <span className="text-foreground dark:text-white">!</span>
      </span>
    </Link>
  );
}
