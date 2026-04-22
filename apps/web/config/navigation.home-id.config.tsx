import { Home, Settings, Users } from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

const iconClasses = 'w-4';

export function getHomeIdNavigationConfig(id: string) {
  const routes = [
    {
      label: 'Application',
      children: [
        {
          label: 'Home',
          path: `/home/${id}`,
          Icon: <Home className={iconClasses} />,
          end: true,
        },
      ],
    },
    {
      label: 'Club',
      children: [
        {
          label: 'Members',
          path: `/home/${id}/members`,
          Icon: <Users className={iconClasses} />,
        },
      ],
    },
    {
      label: 'Settings',
      children: [
        {
          label: 'Settings',
          path: `/home/${id}/settings`,
          Icon: <Settings className={iconClasses} />,
        },
      ],
    },
  ] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

  return NavigationConfigSchema.parse({
    routes,
    style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
  });
}
