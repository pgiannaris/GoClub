import { use } from 'react';

import { PageBody } from '@kit/ui/page';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { SettingsPageContent } from './settings-content';

export const metadata = {
  title: 'Settings',
};

function SettingsPage() {
  const user = use(requireUserInServerComponent());
  console.log(user);

  return (
    <PageBody>
      {/* @ts-expect-error n/a */}
      <SettingsPageContent user={user} />
    </PageBody>
  );
}

export default SettingsPage;
