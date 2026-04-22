import { PageHeader } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { ProjectBreadcrumbs } from './project-breadcrumbs';

function ProjectLayout(props: React.PropsWithChildren) {
  return (
    <>
      <PageHeader description={<ProjectBreadcrumbs />} />

      {props.children}
    </>
  );
}

export default withI18n(ProjectLayout);
