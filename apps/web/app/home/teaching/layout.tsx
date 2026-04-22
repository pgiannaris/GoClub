import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageHeader } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

function TeachingLayout(props: React.PropsWithChildren) {
  return (
    <>
      <PageHeader
        title="🎓 Supabase Tutorial"
        description={<AppBreadcrumbs />}
      />

      {props.children}
    </>
  );
}

export default withI18n(TeachingLayout);
