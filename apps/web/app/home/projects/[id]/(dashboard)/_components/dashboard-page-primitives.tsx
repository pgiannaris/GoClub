'use client';

import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function DashboardPageHeader(props: DashboardPageHeaderProps) {
  const { title, description, action } = props;

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {action ?? null}
    </div>
  );
}

type DashboardLoadingListProps = {
  count?: number;
  keyPrefix?: string;
};

export function DashboardLoadingList(props: DashboardLoadingListProps) {
  const { count = 4, keyPrefix = 'dashboard-loading' } = props;

  return Array.from({ length: count }).map((_, index) => (
    <div key={`${keyPrefix}-${index}`} className="rounded-md border p-4">
      <div className="bg-muted/60 h-4 w-48 animate-pulse rounded" />
    </div>
  ));
}

export function DashboardEmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
      {message}
    </div>
  );
}

