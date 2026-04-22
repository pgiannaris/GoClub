import { use } from 'react';

import {
  Page,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { navigationConfig } from '~/config/navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ContextualOnboarding } from './_components/contextual-onboarding';
// home imports
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { HomeSidebar } from './_components/home-sidebar';

function HomeLayout({ children }: React.PropsWithChildren) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

export default withI18n(HomeLayout);

function SidebarLayout({ children }: React.PropsWithChildren) {
  const sidebarMinimized = navigationConfig.sidebarCollapsed;
  const [user] = use(Promise.all([requireUserInServerComponent()]));

  return (
    <SidebarProvider defaultOpen={sidebarMinimized}>
      <Page
        style={'sidebar'}
        contentContainerClassName={
          'mx-auto flex h-screen w-full flex-col overflow-y-auto bg-inherit pl-0 md:group-data-[sidebar-visible=true]:pl-[var(--sidebar-width-icon)]'
        }
      >
        <PageNavigation className={'shrink-0'}>
          <HomeSidebar user={user} />
        </PageNavigation>

        <PageMobileNavigation className={'flex items-center justify-between'}>
          <MobileNavigation />
        </PageMobileNavigation>

        <ContextualOnboarding />

        {children}
      </Page>
    </SidebarProvider>
  );
}

function MobileNavigation() {
  return (
    <>
      <AppLogo
        width={24}
        className={'h-6 w-6 shrink-0 object-contain'}
      />

      <HomeMobileNavigation />
    </>
  );
}
