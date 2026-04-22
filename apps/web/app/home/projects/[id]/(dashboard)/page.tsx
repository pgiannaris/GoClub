import { PageBody } from '@kit/ui/page';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ProjectDetailContent } from './project-content';

export const metadata = {
  title: 'Club Details',
};

async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserInServerComponent();

  return (
    <PageBody>
      <ProjectDetailContent user={user} projectId={id} />
    </PageBody>
  );
}

export default ProjectPage;
