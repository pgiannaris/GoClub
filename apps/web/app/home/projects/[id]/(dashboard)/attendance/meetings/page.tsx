'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { CalendarPlus, RefreshCw, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { DatePickerField } from '../../_components/date-time-picker-field';
import { AttendancePageShell } from '../_components/attendance-page-shell';
import { formatReadableDate, todayIso } from '../_lib/attendance-utils';
import { useAttendanceWorkspace } from '../_lib/use-attendance-workspace';

export default function AttendanceMeetingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const {
    createSession,
    creatingSession,
    deleteSession,
    deletingSessionId,
    loading,
    refresh,
    sessionEntryCounts,
    sessions,
  } = useAttendanceWorkspace(projectId);

  const [form, setForm] = useState({
    title: '',
    meeting_date: todayIso(),
    notes: '',
    is_public: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [publicOnly, setPublicOnly] = useState(false);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(
    null,
  );

  const totalEntries = useMemo(() => {
    return Object.values(sessionEntryCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
  }, [sessionEntryCounts]);

  const filteredSessions = useMemo(() => {
    let result = sessions.slice();

    if (publicOnly) {
      result = result.filter((s) => Boolean(s.is_public));
    }

    if (upcomingOnly) {
      const today = todayIso();
      result = result.filter((s) => s.meeting_date >= today);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;
    return result.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, publicOnly, upcomingOnly, searchQuery]);

  const handleCreateMeeting = async () => {
    const created = await createSession(form);
    if (!created) return;

    setForm((prev) => ({
      ...prev,
      title: '',
      notes: '',
    }));
  };

  const handleDeleteMeeting = async () => {
    if (!sessionToDeleteId) return;

    const session = sessions.find(
      (candidate) => candidate.id === sessionToDeleteId,
    );
    if (!session) return;

    const deleted = await deleteSession(session);
    if (!deleted) return;

    setDeleteModalOpen(false);
    setSessionToDeleteId(null);
  };

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Meetings"
      description="Create, review, and delete attendance meetings here so the attendance-taking screen stays focused."
      actions={
        <>
          <Input
            placeholder="Search meetings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Filter
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={publicOnly}
                onSelect={(e) => {
                  e.preventDefault?.();
                  setPublicOnly((v) => !v);
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                    {publicOnly ? (
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span>Public only</span>
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={upcomingOnly}
                onSelect={(e) => {
                  e.preventDefault?.();
                  setUpcomingOnly((v) => !v);
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                    {upcomingOnly ? (
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span>Upcoming only</span>
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Meetings" value={sessions.length} />
        <MetricCard label="Attendance Entries" value={totalEntries} />
        <MetricCard
          label="Latest Meeting"
          value={
            sessions[0] ? formatReadableDate(sessions[0].meeting_date) : 'None'
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              New Meeting
            </CardTitle>
            <CardDescription>
              Create meetings here instead of inside the attendance workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="meeting-title"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Title
              </label>
              <Input
                id="meeting-title"
                value={form.title}
                maxLength={120}
                placeholder="Weekly club meeting"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="meeting-date"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Meeting Date
              </label>
              <DatePickerField
                id="meeting-date"
                value={form.meeting_date}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    meeting_date: value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="meeting-notes"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Notes
              </label>
              <Textarea
                id="meeting-notes"
                rows={4}
                maxLength={2000}
                value={form.notes}
                placeholder="Agenda, reminders, or context for the meeting"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
              <div className="text-muted-foreground text-right text-xs">
                {form.notes.length}/2000
              </div>
            </div>

            <label className="border-border/70 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
              <Checkbox
                checked={form.is_public}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_public: Boolean(checked) }))
                }
              />
              <div>
                <div className="font-medium">Visible on the public site</div>
                <div className="text-muted-foreground text-xs">
                  Keep this off unless the meeting should be visible outside the
                  dashboard.
                </div>
              </div>
            </label>

            <Button
              className="w-full"
              onClick={() => void handleCreateMeeting()}
              disabled={creatingSession}
            >
              {creatingSession ? 'Creating...' : 'Create Meeting'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Existing Meetings</CardTitle>
            <CardDescription>
              Open a meeting in the attendance screen or remove it if it should
              no longer exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`meeting-skeleton-${index}`}
                  className="bg-muted/40 h-20 animate-pulse rounded-xl"
                />
              ))
            ) : filteredSessions.length === 0 ? (
              <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
                No meetings yet. Create your first one from the form on the
                left.
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className="border-border/70 hover:bg-muted/20 flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-4 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{session.title}</div>
                      {session.is_public ? (
                        <Badge className="border border-sky-200 bg-sky-50 text-sky-700 shadow-none">
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline">Private</Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatReadableDate(session.meeting_date)}
                    </div>
                    {session.notes ? (
                      <p className="text-muted-foreground max-w-2xl text-sm">
                        {session.notes}
                      </p>
                    ) : null}
                    <div className="text-muted-foreground text-xs">
                      {sessionEntryCounts[session.id] ?? 0} attendance entr
                      {(sessionEntryCounts[session.id] ?? 0) === 1
                        ? 'y'
                        : 'ies'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline">
                      <Link
                        href={`/home/projects/${encodeURIComponent(projectId)}/attendance?session=${encodeURIComponent(session.id)}`}
                      >
                        Open Attendance
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={deletingSessionId === session.id}
                      onClick={() => {
                        setSessionToDeleteId(session.id);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingSessionId === session.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setSessionToDeleteId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete meeting?</DialogTitle>
            <DialogDescription>
              This will permanently remove this meeting and all its attendance
              entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={
                sessionToDeleteId
                  ? deletingSessionId === sessionToDeleteId
                  : false
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteMeeting()}
              disabled={
                !sessionToDeleteId || deletingSessionId === sessionToDeleteId
              }
            >
              {sessionToDeleteId && deletingSessionId === sessionToDeleteId
                ? 'Deleting...'
                : 'Delete Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttendancePageShell>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border-border/70 bg-card rounded-2xl border px-4 py-3 shadow-sm">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
