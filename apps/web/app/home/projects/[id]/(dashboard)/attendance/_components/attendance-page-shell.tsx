'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@kit/ui/utils';

type AttendancePageShellProps = {
  title: string;
  description: string;
  projectId: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AttendancePageShell(props: AttendancePageShellProps) {
  const { title, description, projectId, actions, children } = props;
  const pathname = usePathname();
  const basePath = `/home/projects/${encodeURIComponent(projectId)}/attendance`;

  const sections = [
    {
      href: basePath,
      label: 'Attendance',
      description: 'Select a meeting and mark statuses.',
    },
    {
      href: `${basePath}/meetings`,
      label: 'Meetings',
      description: 'Create and manage meeting records.',
    },
    {
      href: `${basePath}/search`,
      label: 'Search',
      description: 'Filter attendance history quickly.',
    },
    {
      href: `${basePath}/analytics`,
      label: 'Analytics',
      description: 'Review long-term attendance trends.',
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <nav className="overflow-x-auto border-b border-border/70">
        <div className="flex min-w-max gap-6 pr-2">
          {sections.map((section) => {
            const isActive = pathname === section.href;

            return (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  'border-b-2 pb-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
