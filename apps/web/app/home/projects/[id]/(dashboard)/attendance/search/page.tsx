'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { DatePickerField } from '../../_components/date-time-picker-field';
import { AttendancePageShell } from '../_components/attendance-page-shell';
import { AttendanceStatusBadge } from '../_components/attendance-status-controls';
import {
  ATTENDANCE_STATUS_OPTIONS,
  type StatusFilter,
  buildAttendanceHistory,
  formatReadableDate,
} from '../_lib/attendance-utils';
import { useAttendanceWorkspace } from '../_lib/use-attendance-workspace';

export default function AttendanceSearchPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const {
    allKnownNames,
    entriesBySession,
    loading,
    members,
    refresh,
    sessions,
  } = useAttendanceWorkspace(projectId);

  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [meetingFilter, setMeetingFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [studentInputFocused, setStudentInputFocused] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] =
    useState(-1);
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Set<string>>(
    new Set(),
  );

  const historyRows = useMemo(
    () => buildAttendanceHistory(sessions, entriesBySession, members),
    [entriesBySession, members, sessions],
  );

  const studentSuggestions = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return [];

    const startsWithMatches: string[] = [];
    const includesMatches: string[] = [];

    allKnownNames.forEach((name) => {
      const normalizedName = name.toLowerCase();
      if (normalizedName === query) return;

      if (normalizedName.startsWith(query)) {
        startsWithMatches.push(name);
        return;
      }

      if (normalizedName.includes(query)) {
        includesMatches.push(name);
      }
    });

    return [...startsWithMatches, ...includesMatches].slice(0, 8);
  }, [allKnownNames, studentQuery]);

  const filteredRows = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();

    return historyRows.filter((row) => {
      const matchesStudent = query
        ? row.member_name.toLowerCase().includes(query)
        : true;
      const matchesStatus =
        statusFilter === 'all' ? true : row.status === statusFilter;
      const matchesMeeting =
        meetingFilter === 'all' ? true : row.session_id === meetingFilter;
      const matchesDate = dateFilter ? row.meeting_date === dateFilter : true;

      return matchesStudent && matchesStatus && matchesMeeting && matchesDate;
    });
  }, [dateFilter, historyRows, meetingFilter, statusFilter, studentQuery]);

  const groupedResults = useMemo(() => {
    const groups = new Map<
      string,
      {
        sessionId: string;
        sessionTitle: string;
        meetingDate: string;
        rows: typeof filteredRows;
      }
    >();

    filteredRows.forEach((row) => {
      const existing = groups.get(row.session_id);
      if (existing) {
        existing.rows.push(row);
        return;
      }

      groups.set(row.session_id, {
        sessionId: row.session_id,
        sessionTitle: row.session_title,
        meetingDate: row.meeting_date,
        rows: [row],
      });
    });

    return Array.from(groups.values()).sort((a, b) =>
      b.meetingDate.localeCompare(a.meetingDate),
    );
  }, [filteredRows]);

  useEffect(() => {
    const validMeetingIds = new Set(
      groupedResults.map((group) => group.sessionId),
    );
    setExpandedMeetingIds((current) => {
      if (current.size === 0) return current;
      const next = new Set(
        Array.from(current).filter((id) => validMeetingIds.has(id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [groupedResults]);

  useEffect(() => {
    if (studentSuggestions.length === 0) {
      setHighlightedSuggestionIndex(-1);
      return;
    }

    if (highlightedSuggestionIndex >= studentSuggestions.length) {
      setHighlightedSuggestionIndex(studentSuggestions.length - 1);
    }
  }, [highlightedSuggestionIndex, studentSuggestions]);

  const selectStudentSuggestion = (name: string) => {
    setStudentQuery(name);
    setStudentInputFocused(false);
    setHighlightedSuggestionIndex(-1);
  };

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Attendance Search"
      description="Search by student, status, meeting, or date without digging through the attendance-taking workflow."
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
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow the attendance history by the person, meeting, status, or
            date you care about.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <label
              htmlFor="student-query"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Student
            </label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4" />
              <Input
                id="student-query"
                className="pl-9"
                value={studentQuery}
                autoComplete="off"
                onFocus={() => setStudentInputFocused(true)}
                onBlur={() => {
                  setStudentInputFocused(false);
                  setHighlightedSuggestionIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (!studentInputFocused || studentSuggestions.length === 0)
                    return;

                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setHighlightedSuggestionIndex((currentIndex) =>
                      currentIndex >= studentSuggestions.length - 1
                        ? 0
                        : currentIndex + 1,
                    );
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setHighlightedSuggestionIndex((currentIndex) =>
                      currentIndex <= 0
                        ? studentSuggestions.length - 1
                        : currentIndex - 1,
                    );
                  }

                  if (event.key === 'Enter') {
                    const selectedName =
                      highlightedSuggestionIndex >= 0
                        ? studentSuggestions[highlightedSuggestionIndex]
                        : studentSuggestions[0];

                    if (!selectedName) return;

                    event.preventDefault();
                    selectStudentSuggestion(selectedName);
                  }

                  if (event.key === 'Escape') {
                    setStudentInputFocused(false);
                    setHighlightedSuggestionIndex(-1);
                  }
                }}
                onChange={(event) => {
                  setStudentQuery(event.target.value);
                  setHighlightedSuggestionIndex(-1);
                }}
                placeholder="Search by full or partial name"
              />

              {studentInputFocused && studentSuggestions.length > 0 ? (
                <div className="border-border/70 bg-background absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border shadow-lg">
                  {studentSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={cn(
                        'hover:bg-muted/40 block w-full px-3 py-2 text-left text-sm transition-colors',
                        studentSuggestions[highlightedSuggestionIndex] ===
                          name && 'bg-muted/40',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => {
                        setHighlightedSuggestionIndex(
                          studentSuggestions.indexOf(name),
                        );
                      }}
                      onClick={() => selectStudentSuggestion(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Status
            </label>
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
                  <SelectItem
                    key={statusOption.value}
                    value={statusOption.value}
                  >
                    {statusOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Date
            </label>
            <DatePickerField value={dateFilter} onChange={setDateFilter} />
          </div>

          <div className="space-y-2 lg:col-span-3">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Meeting
            </label>
            <Select value={meetingFilter} onValueChange={setMeetingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All meetings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All meetings</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {formatReadableDate(session.meeting_date)} - {session.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStudentQuery('');
                setStatusFilter('all');
                setMeetingFilter('all');
                setDateFilter('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {groupedResults.length} meeting
                {groupedResults.length === 1 ? '' : 's'} and{' '}
                {filteredRows.length} matching attendance record
                {filteredRows.length === 1 ? '' : 's'}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const allExpanded =
                    groupedResults.length > 0 &&
                    groupedResults.every((group) =>
                      expandedMeetingIds.has(group.sessionId),
                    );
                  if (allExpanded) {
                    setExpandedMeetingIds(new Set());
                    return;
                  }
                  setExpandedMeetingIds(
                    new Set(groupedResults.map((group) => group.sessionId)),
                  );
                }}
                disabled={loading || groupedResults.length === 0}
              >
                {groupedResults.length > 0 &&
                groupedResults.every((group) =>
                  expandedMeetingIds.has(group.sessionId),
                )
                  ? 'Collapse all'
                  : 'Expand all'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <div className="divide-border/60 divide-y">
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`search-skeleton-${index}`}
                    className="animate-pulse px-4 py-4"
                  >
                    <div className="bg-muted/40 h-10 rounded-xl" />
                  </div>
                ))
              ) : groupedResults.length === 0 ? (
                <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                  No attendance records match the current filters.
                </div>
              ) : (
                groupedResults.map((group) => {
                  const isExpanded = expandedMeetingIds.has(group.sessionId);
                  return (
                    <div key={group.sessionId}>
                      <button
                        type="button"
                        className="hover:bg-muted/20 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                        onClick={() =>
                          setExpandedMeetingIds((current) => {
                            const next = new Set(current);
                            if (next.has(group.sessionId))
                              next.delete(group.sessionId);
                            else next.add(group.sessionId);
                            return next;
                          })
                        }
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="text-muted-foreground h-4 w-4" />
                            ) : (
                              <ChevronRight className="text-muted-foreground h-4 w-4" />
                            )}
                            <span className="font-medium">
                              {group.sessionTitle}
                            </span>
                          </div>
                          <div className="text-muted-foreground pl-6 text-xs">
                            {formatReadableDate(group.meetingDate)}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {group.rows.length} record
                          {group.rows.length === 1 ? '' : 's'}
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="pl-8">
                          <table className="border-border/50 min-w-full border-t">
                            <thead className="bg-muted/20">
                              <tr className="text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
                                <th className="px-4 py-2">Student</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                              {group.rows.map((row) => (
                                <tr
                                  key={row.key}
                                  className="hover:bg-muted/10 transition-colors"
                                >
                                  <td className="px-4 py-3 text-sm">
                                    {row.member_name}
                                  </td>
                                  <td className="text-muted-foreground px-4 py-3 text-sm">
                                    {row.is_roster ? 'Roster' : 'Manual'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <AttendanceStatusBadge
                                      status={row.status}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AttendancePageShell>
  );
}
