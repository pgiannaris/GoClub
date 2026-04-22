import { PageHeader } from '@kit/ui/page';

import MainPageDashboard from './_components/MainPageDashboard';

export default function HomePage() {
  return (
    <>
      <PageHeader description={'Projects'} />

      <MainPageDashboard />
    </>
  );
}
