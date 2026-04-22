'use client';

import { Badge } from '@kit/ui/badge';
import { cn } from '@kit/ui/utils';

import {
  type AttendanceStatus,
  statusBadgeClass,
  statusLabel,
} from '../_lib/attendance-utils';

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge className={cn('border font-medium shadow-none', statusBadgeClass(status))}>
      {statusLabel(status)}
    </Badge>
  );
}

type AttendanceStatusSelectorProps = {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
};

export function AttendanceStatusSelector(props: AttendanceStatusSelectorProps) {
  const { value, onChange } = props;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 w-full min-w-0 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[140px]',
        statusBadgeClass(value),
      )}
      onClick={() => onChange(nextAttendanceStatus(value))}
    >
      {statusLabel(value)}
    </button>
  );
}

function nextAttendanceStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === 'present') return 'late';
  if (status === 'late') return 'excused';
  if (status === 'excused') return 'absent';
  return 'present';
}
