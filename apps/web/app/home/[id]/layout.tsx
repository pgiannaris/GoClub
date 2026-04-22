import { use } from 'react';

import {
  Page,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';
import { SidebarProvider } from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { getHomeIdNavigationConfig } from '~/config/navigation.home-id.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { HomeMobileNavigation } from '../_components/home-mobile-navigation';
import { HomeSidebar } from '../_components/home-sidebar';

function HomeIdLayout({
  children,
  params,
}: React.PropsWithChildren<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  return <SidebarLayout id={id}>{children}</SidebarLayout>;
}

export default withI18n(HomeIdLayout);

function SidebarLayout({
  children,
  id,
}: React.PropsWithChildren<{ id: string }>) {
  const [user] = use(Promise.all([requireUserInServerComponent()]));
  const config = getHomeIdNavigationConfig(id);

  return (
    <SidebarProvider>
        <Page
          style={'sidebar'}
          contentContainerClassName={
          'mx-auto flex h-screen w-full flex-col overflow-y-auto bg-inherit pl-0 md:group-data-[sidebar-visible=true]:pl-[var(--sidebar-width-icon)]'
          }
        >
        <PageNavigation className={'shrink-0'}>
          <HomeSidebar user={user} config={config} />
        </PageNavigation>

        <PageMobileNavigation className={'flex items-center justify-between'}>
          <MobileNavigation />
        </PageMobileNavigation>

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
