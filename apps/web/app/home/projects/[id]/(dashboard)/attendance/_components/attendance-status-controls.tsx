'use client';

import { Badge } from '@kit/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';
import { ChevronDown } from 'lucide-react';

import {
  type AttendanceStatus,
  statusBadgeClass,
  statusLabel,
} from '../_lib/attendance-utils';
import type { DraftAttendanceStatus } from '../_lib/use-attendance-workspace';

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge className={cn('border font-medium shadow-none', statusBadgeClass(status))}>
      {statusLabel(status)}
    </Badge>
  );
}

type AttendanceStatusSelectorProps = {
  value: DraftAttendanceStatus;
  onChange: (status: DraftAttendanceStatus) => void;
};

export function AttendanceStatusSelector(props: AttendanceStatusSelectorProps) {
  const { value, onChange } = props;

  return (
    <div className="inline-flex w-full min-w-0 sm:w-auto">
      <button
        type="button"
        className={cn(
          'inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-l-xl border border-r-0 px-3 text-sm font-medium transition-opacity hover:opacity-90 sm:min-w-[140px]',
          value === 'unmarked'
            ? 'border-slate-300 bg-slate-100 text-slate-700'
            : statusBadgeClass(value),
        )}
        onClick={() => onChange(nextAttendanceStatus(value))}
      >
        {value === 'unmarked' ? 'Unmarked' : statusLabel(value)}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Select attendance status"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-r-xl border text-sm transition-opacity hover:opacity-90',
              value === 'unmarked'
                ? 'border-slate-300 bg-slate-100 text-slate-700'
                : statusBadgeClass(value),
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onChange('present')}>
            Present
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChange('late')}>
            Late
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChange('excused')}>
            Excused
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChange('absent')}>
            Absent
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onChange('unmarked')}>
            Unmarked
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function nextAttendanceStatus(status: DraftAttendanceStatus): DraftAttendanceStatus {
  if (status === 'unmarked') return 'present';
  if (status === 'present') return 'late';
  if (status === 'late') return 'excused';
  if (status === 'excused') return 'absent';
  return 'present';
}
