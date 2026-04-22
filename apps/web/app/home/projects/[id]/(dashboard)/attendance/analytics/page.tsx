'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { AttendancePageShell } from '../_components/attendance-page-shell';
import {
  buildOverallAttendanceRows,
  formatWeighted,
  type AttendanceTypeFilter,
  type ExcusedWeight,
} from '../_lib/attendance-utils';
import { useAttendanceWorkspace } from '../_lib/use-attendance-workspace';

type PercentComparison =
  | 'gte'
  | 'gt'
  | 'eq'
  | 'lte'
  | 'lt';

export default function AttendanceAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { allKnownNames, entriesBySession, loading, members, refresh, sessions } =
    useAttendanceWorkspace(projectId);

  const [studentQuery, setStudentQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AttendanceTypeFilter>('all');
  const [excusedWeight, setExcusedWeight] = useState<ExcusedWeight>(0.5);
  const [percentComparison, setPercentComparison] =
    useState<PercentComparison>('gte');
  const [percentQuery, setPercentQuery] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const overallRows = useMemo(
    () =>
      buildOverallAttendanceRows({
        members,
        sessions,
        entriesBySession,
        excusedWeight,
      }),
    [entriesBySession, excusedWeight, members, sessions],
  );

  const filteredRows = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    const parsedPercent = Number(percentQuery.trim());
    const hasPercentFilter =
      percentQuery.trim().length > 0 && Number.isFinite(parsedPercent);

    return overallRows.filter((row) => {
      const matchesStudent = query ? row.member_name.toLowerCase().includes(query) : true;
      const matchesType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'roster'
            ? row.is_roster
            : !row.is_roster;
      const matchesPercent = hasPercentFilter
        ? matchesPercentFilter(row.percent, parsedPercent, percentComparison)
        : true;

      return matchesStudent && matchesType && matchesPercent;
    });
  }, [overallRows, studentQuery, typeFilter, percentComparison, percentQuery]);

  const averagePercent = useMemo(() => {
    if (filteredRows.length === 0) return 0;
    return Math.round(
      filteredRows.reduce((sum, row) => sum + row.percent, 0) / filteredRows.length,
    );
  }, [filteredRows]);

  const clearFilters = () => {
    setStudentQuery('');
    setTypeFilter('all');
    setPercentComparison('gte');
    setPercentQuery('');
    setExcusedWeight(0.5);
    setShowMoreFilters(false);
  };

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Attendance Analytics"
      description="Review long-term attendance trends with configurable excused weighting and a clearer split between roster and manual attendees."
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
      <datalist id="attendance-analytics-name-suggestions">
        {allKnownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="People" value={filteredRows.length} />
        <MetricCard label="Meetings" value={sessions.length} />
        <MetricCard label="Average Attendance" value={`${averagePercent}%`} />
        <MetricCard label="Excused Weight" value={excusedWeight === 0.5 ? '50%' : '0%'} />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow the table by name or attendee type, then open more filters for
            attendance thresholds and excused weighting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Student
              </label>
              <Input
                value={studentQuery}
                list="attendance-analytics-name-suggestions"
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Filter by attendee name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AttendanceTypeFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All attendees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All attendees</SelectItem>
                  <SelectItem value="roster">Roster only</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMoreFilters((current) => !current)}
              >
                {showMoreFilters ? 'Hide filters' : 'More filters'}
              </Button>

              <Button type="button" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>

          {showMoreFilters ? (
            <div className="grid gap-4 border-t border-border/60 pt-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Attendance Percent
                </label>
                <div className="flex gap-2">
                  <Select
                    value={percentComparison}
                    onValueChange={(value) => setPercentComparison(value as PercentComparison)}
                  >
                    <SelectTrigger className="w-24 shrink-0">
                      <SelectValue placeholder=">=" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">&ge;</SelectItem>
                      <SelectItem value="gt">&gt;</SelectItem>
                      <SelectItem value="eq">=</SelectItem>
                      <SelectItem value="lte">&le;</SelectItem>
                      <SelectItem value="lt">&lt;</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={percentQuery}
                    onChange={(event) => setPercentQuery(event.target.value)}
                    placeholder="Type a percent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Excused Weight
                </label>
                <Select
                  value={String(excusedWeight)}
                  onValueChange={(value) => setExcusedWeight((value === '0' ? 0 : 0.5) as ExcusedWeight)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">Count excused as 0.5</SelectItem>
                    <SelectItem value="0">Count excused as 0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Overall Attendance</CardTitle>
          <CardDescription>
            Late counts as full attendance. Excused currently counts as {excusedWeight === 0.5 ? '50%' : '0%'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Late</th>
                  <th className="px-4 py-3">Excused</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Percent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={`analytics-skeleton-${index}`} className="animate-pulse">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-10 rounded-xl bg-muted/40" />
                      </td>
                    </tr>
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No analytics rows match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.key} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.member_name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.is_roster ? 'Roster' : 'Manual'}
                      </td>
                      <td className="px-4 py-3 text-sm">{row.present_count}</td>
                      <td className="px-4 py-3 text-sm">{row.late_count}</td>
                      <td className="px-4 py-3 text-sm">{row.excused_count}</td>
                      <td className="px-4 py-3 text-sm">{row.absent_count}</td>
                      <td className="px-4 py-3 text-sm">
                        {formatWeighted(row.weighted_attendance)} / {row.total_sessions}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${row.percent}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{row.percent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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

function matchesPercentFilter(
  value: number,
  threshold: number,
  comparison: PercentComparison,
) {
  if (comparison === 'gt') return value > threshold;
  if (comparison === 'eq') return value === threshold;
  if (comparison === 'lte') return value <= threshold;
  if (comparison === 'lt') return value < threshold;
  return value >= threshold;
}
