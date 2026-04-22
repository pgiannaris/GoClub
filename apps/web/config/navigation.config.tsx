import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  ClipboardList,
  Home,
  Info,
  Mail,
  Megaphone,
  Pencil,
  Settings,
  User,
  Users,
} from 'lucide-react';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

export function getNavigationConfig(pathname?: string) {
  const isProjectPath = pathname?.includes('/projects/') ?? false;

  // Extract project ID from pathname
  const projectIdMatch = pathname?.match(/\/projects\/([^/]+)/);
  const projectId = projectIdMatch?.[1] || '';

  const projectBasePath = projectId ? `/home/projects/${projectId}` : '';

  const routes = isProjectPath
    ? [
        {
          label: 'common:routes.application',
          children: [
            {
              label: 'All Projects',
              path: '/home',
              Icon: <ArrowLeft className={`${iconClasses} arrowLeftIcon`} />,
              end: true,
            },
          ],
        },
        {
          label: '',
          children: [
            {
              label: 'Overview',
              path: projectBasePath,
              Icon: <Home className={iconClasses} />,
              end: true,
            },
            {
              label: 'Events',
              path: `${projectBasePath}/events`,
              Icon: <Calendar className={iconClasses} />,
              end: false,
            },
            {
              label: 'Announcements',
              path: `${projectBasePath}/announcements`,
              Icon: <Megaphone className={iconClasses} />,
              end: false,
            },
            {
              label: 'Polls',
              path: `${projectBasePath}/polls`,
              Icon: <ClipboardList className={iconClasses} />,
              end: false,
            },
            {
              label: 'Attendance',
              path: `${projectBasePath}/attendance`,
              Icon: <CheckSquare className={iconClasses} />,
              end: false,
            },
            {
              label: 'Members',
              path: `${projectBasePath}/members`,
              Icon: <Users className={iconClasses} />,
              end: false,
            },
            {
              label: 'Settings',
              path: `${projectBasePath}/settings`,
              Icon: <Settings className={iconClasses} />,
              end: false,
            },
            {
              label: 'Edit',
              path: `${projectBasePath}/editor`,
              Icon: <Pencil className={iconClasses} />,
              end: false,
            },
          ],
        },
      ]
    : [
        {
          label: 'common:routes.application',
          children: [
            {
              label: 'common:routes.home',
              path: pathsConfig.app.home,
              Icon: <Home className={iconClasses} />,
              end: true,
            },
          ],
        },
        {
          label: 'common:routes.settings',
          children: [
            {
              label: 'My Profile',
              path: pathsConfig.app.profileSettings,
              Icon: <User className={iconClasses} />,
            },
          ],
        },
      ];

  // Filter out empty groups
  const filteredRoutes = routes.filter(
    (route) => !('children' in route) || route.children.length > 0,
  );

  return NavigationConfigSchema.parse({
    routes: filteredRoutes,
    style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
    sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
  });
}

export const navigationConfig = getNavigationConfig();
