import { use } from 'react';

import { PageBody } from '@kit/ui/page';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TutorialContent } from './tutorial-content';

export const metadata = {
  title: 'Supabase Tutorial',
};

function TeachingPage() {
  const user = use(requireUserInServerComponent());

  return (
    <PageBody>
      <TutorialContent user={user} />
    </PageBody>
  );
}

export default TeachingPage;
