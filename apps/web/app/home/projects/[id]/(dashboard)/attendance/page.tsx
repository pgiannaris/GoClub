'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { Pencil, Search, TriangleAlert, X } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { AttendancePageShell } from './_components/attendance-page-shell';
import { AttendanceStatusSelector } from './_components/attendance-status-controls';
import {
  ATTENDANCE_STATUS_OPTIONS,
  calculateSessionStats,
  capitalize,
  formatReadableDate,
  type StatusFilter,
} from './_lib/attendance-utils';
import { useAttendanceWorkspace } from './_lib/use-attendance-workspace';

export default function AttendancePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const requestedSessionId = searchParams.get('session');

  const {
    attendanceRows,
    addManualAttendee,
    allKnownNames,
    changedRowKeys,
    discardChanges,
    hasUnsavedChanges,
    loading,
    removeManualAttendee,
    renameSession,
    renamingSessionId,
    saveAttendance,
    savingAttendance,
    selectedSession,
    selectedSessionId,
    sessions,
    setAttendanceStatus,
    setSelectedSessionId,
  } = useAttendanceWorkspace(projectId, { autoCreateToday: true });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [manualAttendeeName, setManualAttendeeName] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [editingMeetingName, setEditingMeetingName] = useState(false);
  const [meetingNameDraft, setMeetingNameDraft] = useState('');

  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const meetingNameInputRef = useRef<HTMLInputElement | null>(null);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return attendanceRows.filter((row) => {
      const matchesName = row.member_name.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' ? true : row.status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [attendanceRows, searchQuery, statusFilter]);

  const canClearFilters = searchQuery.trim().length > 0 || statusFilter !== 'all';
  const sessionStats = useMemo(() => calculateSessionStats(attendanceRows), [attendanceRows]);

  useEffect(() => {
    if (!requestedSessionId || hasUnsavedChanges) return;
    if (!sessions.some((session) => session.id === requestedSessionId)) return;
    if (requestedSessionId === selectedSessionId) return;

    setSelectedSessionId(requestedSessionId);
  }, [hasUnsavedChanges, requestedSessionId, selectedSessionId, sessions, setSelectedSessionId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;

      if (!anchor || anchor.target === '_blank') return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, currentUrl.href);

      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      const confirmed = window.confirm('You have unsaved attendance changes. Leave this page?');
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const shouldOpenTools =
      searchQuery.trim().length > 0 ||
      manualAttendeeName.trim().length > 0 ||
      statusFilter !== 'all';

    if (shouldOpenTools) {
      setToolsOpen(true);
    }
  }, [manualAttendeeName, searchQuery, statusFilter]);

  useEffect(() => {
    setMeetingNameDraft(selectedSession?.title ?? '');
    setEditingMeetingName(false);
  }, [selectedSession?.id, selectedSession?.title]);

  useEffect(() => {
    if (!editingMeetingName) return;

    requestAnimationFrame(() => {
      meetingNameInputRef.current?.focus();
      meetingNameInputRef.current?.select();
    });
  }, [editingMeetingName]);

  const handleAddManualAttendee = () => {
    const added = addManualAttendee(manualAttendeeName);
    if (!added) return;

    setManualAttendeeName('');
    setToolsOpen(true);
    requestAnimationFrame(() => {
      manualInputRef.current?.focus();
    });
  };

  const handleSessionChange = (nextSessionId: string) => {
    if (nextSessionId === selectedSessionId) return;

    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved attendance changes. Switch meetings and discard them?')
    ) {
      return;
    }

    setSelectedSessionId(nextSessionId);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const handleMeetingRename = async () => {
    if (!selectedSession) return;

    const renamed = await renameSession(selectedSession.id, meetingNameDraft);
    if (!renamed) return;

    setEditingMeetingName(false);
  };

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Attendance"
      description="Choose a meeting, mark each attendee clearly, and save changes when the session is ready."
    >
      <datalist id="attendance-name-suggestions">
        {allKnownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="sticky top-4 z-20 min-w-0 space-y-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current meeting
            </div>
            {selectedSession ? (
              editingMeetingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    ref={meetingNameInputRef}
                    value={meetingNameDraft}
                    maxLength={120}
                    className="h-9 w-full max-w-md text-base font-semibold"
                    onChange={(event) => setMeetingNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleMeetingRename();
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setMeetingNameDraft(selectedSession.title);
                        setEditingMeetingName(false);
                      }
                    }}
                    placeholder="Enter a meeting name"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleMeetingRename()}
                    disabled={renamingSessionId === selectedSession.id}
                  >
                    {renamingSessionId === selectedSession.id ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setMeetingNameDraft(selectedSession.title);
                      setEditingMeetingName(false);
                    }}
                    disabled={renamingSessionId === selectedSession.id}
                    aria-label="Cancel meeting rename"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="min-w-0 break-words text-lg font-semibold">{selectedSession.title}</div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setEditingMeetingName(true)}
                    aria-label="Rename meeting"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )
            ) : (
              <div className="text-lg font-semibold">Select a meeting to begin</div>
            )}
            <div className="text-xs text-muted-foreground">
              {selectedSession
                ? formatReadableDate(selectedSession.meeting_date)
                : 'Choose the meeting you want to mark attendance for.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                hasUnsavedChanges
                  ? 'border-orange-800 border-2 text-orange-500'
                  : 'border-border/70 text-muted-foreground',
              )}
            >
              {hasUnsavedChanges ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
              <span>
                {hasUnsavedChanges
                  ? `${changedRowKeys.size} unsaved change${changedRowKeys.size === 1 ? '' : 's'}`
                  : 'All changes saved'}
              </span>
            </div>
            {hasUnsavedChanges ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discardChanges}
                disabled={savingAttendance}
              >
                Discard
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => void saveAttendance()}
              disabled={!hasUnsavedChanges || savingAttendance}
            >
              {savingAttendance ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full min-w-0 max-w-sm space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meeting selector
            </div>
            <Select value={selectedSessionId ?? undefined} onValueChange={handleSessionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a meeting" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {formatReadableDate(session.meeting_date)} - {session.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/home/projects/${encodeURIComponent(projectId)}/attendance/meetings`}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Meetings
            </Link>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setToolsOpen((open) => !open)}
            >
              {toolsOpen ? 'Hide filters and tools' : 'Filters and tools'}
            </button>
          </div>
        </div>

        {toolsOpen ? (
          <div className="grid gap-3 border-t border-border/70 pt-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Search attendee
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchQuery}
                  list="attendance-name-suggestions"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Start typing a name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add attendee
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  ref={manualInputRef}
                  value={manualAttendeeName}
                  maxLength={80}
                  onChange={(event) => setManualAttendeeName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddManualAttendee();
                    }
                  }}
                  placeholder="Type a name and press Enter"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 sm:self-auto"
                  onClick={handleAddManualAttendee}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filter
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ATTENDANCE_STATUS_OPTIONS.map((statusOption) => (
                    <SelectItem key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-start xl:justify-end">
              {canClearFilters ? (
                <button
                  type="button"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Search, filter, or add attendees when needed.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Present" value={sessionStats.present} />
        <StatCard label="Late" value={sessionStats.late} />
        <StatCard label="Excused" value={sessionStats.excused} />
        <StatCard label="Absent" value={sessionStats.absent} />
        <StatCard label="Rate" value={`${sessionStats.rate}%`} />
      </div>

      {selectedSession?.notes ? (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Meeting note:</span> {selectedSession.notes}
        </div>
      ) : null}

      <Card className="min-w-0 overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border/70 px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Attendance list</div>
                <div className="text-xs text-muted-foreground">
                  {filteredRows.length} attendee{filteredRows.length === 1 ? '' : 's'} in view
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {selectedSession
                  ? formatReadableDate(selectedSession.meeting_date)
                  : 'Select a meeting to start marking attendance'}
              </div>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-x-hidden overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`attendance-row-skeleton-${index}`}
                    className="h-20 animate-pulse rounded-xl bg-muted/40"
                  />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="space-y-4 px-4 py-14 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {!selectedSession
                      ? 'No meeting selected'
                      : attendanceRows.length === 0
                        ? 'No attendees yet'
                        : 'No attendees match the current filters'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {!selectedSession
                      ? 'Create or select a meeting before taking attendance.'
                      : attendanceRows.length === 0
                        ? 'Add an attendee here or update the roster from the members page.'
                        : 'Try clearing the current filters to see more results.'}
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {!selectedSession ? (
                    <Button asChild variant="outline">
                      <Link href={`/home/projects/${encodeURIComponent(projectId)}/attendance/meetings`}>
                        Open meetings
                      </Link>
                    </Button>
                  ) : null}

                  {attendanceRows.length === 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setToolsOpen(true);
                        requestAnimationFrame(() => {
                          manualInputRef.current?.focus();
                        });
                      }}
                    >
                      Add attendee
                    </Button>
                  ) : null}

                  <Button asChild variant="outline">
                    <Link href={`/home/projects/${encodeURIComponent(projectId)}/members`}>
                      Manage roster
                    </Link>
                  </Button>

                  {canClearFilters ? (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredRows.map((row) => {
                  const isChanged = changedRowKeys.has(row.key);

                  return (
                    <div key={row.key} className="px-4 py-3 transition-colors hover:bg-muted/20">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div className="min-w-0 break-words text-sm font-semibold">
                              {row.member_name}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'border font-medium shadow-none',
                                row.is_roster
                                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-700',
                              )}
                            >
                              {row.is_roster ? 'Roster' : 'Manual'}
                            </Badge>
                            {row.role ? (
                              <Badge variant="secondary" className="capitalize">
                                {capitalize(row.role)}
                              </Badge>
                            ) : null}
                            {isChanged ? (
                              <span className="text-xs font-medium text-orange-700">Unsaved</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                          <AttendanceStatusSelector
                            value={row.status}
                            onChange={(status) => setAttendanceStatus(row.key, status)}
                          />
                          {!row.is_roster ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                removeManualAttendee(row.key);
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AttendancePageShell>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
