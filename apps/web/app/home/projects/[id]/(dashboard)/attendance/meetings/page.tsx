'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { CalendarPlus, RefreshCw, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

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

  const totalEntries = useMemo(() => {
    return Object.values(sessionEntryCounts).reduce((sum, count) => sum + count, 0);
  }, [sessionEntryCounts]);

  const handleCreateMeeting = async () => {
    const created = await createSession(form);
    if (!created) return;

    setForm((prev) => ({
      ...prev,
      title: '',
      notes: '',
    }));
  };

  const handleDeleteMeeting = async (sessionId: string) => {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session) return;

    const confirmed = window.confirm(
      `Delete "${session.title}" on ${formatReadableDate(session.meeting_date)}?`,
    );
    if (!confirmed) return;

    await deleteSession(session);
  };

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Meetings"
      description="Create, review, and delete attendance meetings here so the attendance-taking screen stays focused."
      actions={
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
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Meetings" value={sessions.length} />
        <MetricCard label="Attendance Entries" value={totalEntries} />
        <MetricCard label="Latest Meeting" value={sessions[0] ? formatReadableDate(sessions[0].meeting_date) : 'None'} />
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
              <label htmlFor="meeting-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              <label htmlFor="meeting-date" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Meeting Date
              </label>
              <Input
                id="meeting-date"
                type="date"
                value={form.meeting_date}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, meeting_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="meeting-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              <div className="text-right text-xs text-muted-foreground">{form.notes.length}/2000</div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm">
              <Checkbox
                checked={form.is_public}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_public: Boolean(checked) }))
                }
              />
              <div>
                <div className="font-medium">Visible on the public site</div>
                <div className="text-xs text-muted-foreground">
                  Keep this off unless the meeting should be visible outside the dashboard.
                </div>
              </div>
            </label>

            <Button className="w-full" onClick={() => void handleCreateMeeting()} disabled={creatingSession}>
              {creatingSession ? 'Creating...' : 'Create Meeting'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Existing Meetings</CardTitle>
            <CardDescription>
              Open a meeting in the attendance screen or remove it if it should no longer exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`meeting-skeleton-${index}`}
                  className="h-20 animate-pulse rounded-xl bg-muted/40"
                />
              ))
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                No meetings yet. Create your first one from the form on the left.
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/20"
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
                    <div className="text-sm text-muted-foreground">
                      {formatReadableDate(session.meeting_date)}
                    </div>
                    {session.notes ? (
                      <p className="max-w-2xl text-sm text-muted-foreground">{session.notes}</p>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {sessionEntryCounts[session.id] ?? 0} attendance entr
                      {(sessionEntryCounts[session.id] ?? 0) === 1 ? 'y' : 'ies'}
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
                      onClick={() => void handleDeleteMeeting(session.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingSessionId === session.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AttendancePageShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
