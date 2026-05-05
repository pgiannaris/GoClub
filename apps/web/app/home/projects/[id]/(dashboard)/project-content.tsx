'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Pencil,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@kit/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  coerceAttendanceStatus,
  formatReadableDate,
  getAttendanceWeight,
} from './attendance/_lib/attendance-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type ProjectMember = {
  id: string;
  account_id: string;
  role: string;
  joined_at: string | null;
  created_at: string | null;
};

type StudentProfile = {
  id: string;
  full_name: string;
  joined_at: string | null;
};

type ProjectInvitation = {
  id: string;
  status: string;
  created_at: string | null;
};

type Announcement = {
  id: string;
  title: string;
  status: string;
  is_pinned: boolean | null;
  published_at: string | null;
  created_at: string | null;
};

type EventRecord = {
  id: string;
  title: string;
  start_at: string;
  status: string;
  visibility: string;
  created_at: string | null;
};

type AttendanceSessionRecord = {
  id: string;
  title: string;
  meeting_date: string;
  is_public: boolean;
  created_at: string | null;
};

type AttendanceEntryRecord = {
  id: string;
  session_id: string;
  status: unknown;
};

type DashboardData = {
  projectMembers: ProjectMember[];
  students: StudentProfile[];
  pendingInvitations: ProjectInvitation[];
  announcements: Announcement[];
  events: EventRecord[];
  attendanceSessions: AttendanceSessionRecord[];
  recentAttendanceSessions: AttendanceSessionRecord[];
  attendanceEntries: AttendanceEntryRecord[];
};

type AttendanceChartRow = {
  session: string;
  fullLabel: string;
  dateLabel: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendees: number;
  rate: number;
};

type ActivityTrendRow = {
  key: string;
  month: string;
  fullLabel: string;
  announcements: number;
  events: number;
  sessions: number;
  total: number;
};

type AttendanceMixRow = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

type AttendanceStatusTimelineRow = {
  session: string;
  fullLabel: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  total: number;
};

type RosterGrowthRow = {
  key: string;
  month: string;
  fullLabel: string;
  students: number;
  collaborators: number;
  totalPeople: number;
};

type AnnouncementBreakdownRow = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_DASHBOARD_DATA: DashboardData = {
  projectMembers: [],
  students: [],
  pendingInvitations: [],
  announcements: [],
  events: [],
  attendanceSessions: [],
  recentAttendanceSessions: [],
  attendanceEntries: [],
};

const BLUE = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
} as const;

const STATUS_COLORS = {
  present: '#16a34a',
  late: '#d97706',
  excused: '#2563eb',
  absent: '#dc2626',
} as const;

const attendancePerformanceChartConfig = {
  rate: { label: 'Attendance Rate', color: BLUE[500] },
} satisfies ChartConfig;

const activityTrendChartConfig = {
  announcements: { label: 'Announcements', color: BLUE[400] },
  events: { label: 'Events', color: BLUE[600] },
  sessions: { label: 'Meetings', color: BLUE[800] },
  total: { label: 'Total', color: BLUE[500] },
} satisfies ChartConfig;

const attendanceMixChartConfig = {
  count: { label: 'Entries', color: BLUE[500] },
} satisfies ChartConfig;

const attendanceStatusTimelineChartConfig = {
  present: { label: 'Present', color: STATUS_COLORS.present },
  late: { label: 'Late', color: STATUS_COLORS.late },
  excused: { label: 'Excused', color: STATUS_COLORS.excused },
  absent: { label: 'Absent', color: STATUS_COLORS.absent },
} satisfies ChartConfig;

const rosterGrowthChartConfig = {
  totalPeople: { label: 'Total people', color: BLUE[500] },
  students: { label: 'Students', color: BLUE[400] },
  collaborators: { label: 'Collaborators', color: BLUE[200] },
} satisfies ChartConfig;

const announcementBreakdownChartConfig = {
  count: { label: 'Count', color: BLUE[500] },
} satisfies ChartConfig;

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectDetailContent({ projectId }: { projectId: string }) {
  const supabase = useSupabase();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [dashboardData, setDashboardData] =
    useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [attendancePeriod, setAttendancePeriod] = useState<
    'session' | 'daily' | 'weekly' | 'monthly'
  >('session');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    void loadProjectOverview();
  }, [projectId]);

  const loadProjectOverview = async () => {
    setLoading(true);
    try {
      const eventsPromise = fetch(
        `/api/projects/${encodeURIComponent(projectId)}/events`,
        { credentials: 'include' },
      ).then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          events?: EventRecord[];
        };
        if (!response.ok)
          throw new Error(payload.error ?? 'Failed to load events');
        return payload.events ?? [];
      });

      const [
        { data: projectData, error: projectError },
        { data: memberData, error: memberError },
        { data: studentData, error: studentError },
        { data: invitationData, error: invitationError },
        { data: announcementData, error: announcementError },
        { data: sessionData, error: sessionError },
        events,
      ] = await Promise.all([
        (supabase as any)
          .from('projects')
          .select('id, name, description, status, created_at')
          .eq('id', projectId)
          .single(),
        (supabase as any)
          .from('project_members')
          .select('id, account_id, role, joined_at, created_at')
          .eq('project_id', projectId),
        (supabase as any)
          .from('member_profiles')
          .select('id, full_name, joined_at')
          .eq('project_id', projectId),
        (supabase as any)
          .from('project_invitations')
          .select('id, status, created_at')
          .eq('project_id', projectId)
          .eq('status', 'pending'),
        (supabase as any)
          .from('announcements')
          .select('id, title, status, is_pinned, published_at, created_at')
          .eq('project_id', projectId),
        (supabase as any)
          .from('attendance_sessions')
          .select('id, title, meeting_date, is_public, created_at')
          .eq('project_id', projectId)
          .order('meeting_date', { ascending: false }),
        eventsPromise,
      ]);

      if (projectError) throw projectError;
      if (memberError) throw memberError;
      if (studentError) throw studentError;
      if (invitationError) throw invitationError;
      if (announcementError) throw announcementError;
      if (sessionError) throw sessionError;

      const attendanceSessions = (sessionData ??
        []) as AttendanceSessionRecord[];
      const recentAttendanceSessions = attendanceSessions.slice(0, 8);
      const sessionIds = recentAttendanceSessions.map((s) => s.id);

      let attendanceEntries: AttendanceEntryRecord[] = [];
      if (sessionIds.length > 0) {
        const { data: entryData, error: entryError } = await (supabase as any)
          .from('attendance_entries')
          .select('id, session_id, status')
          .in('session_id', sessionIds);
        if (entryError) throw entryError;
        attendanceEntries = (entryData ?? []) as AttendanceEntryRecord[];
      }

      setProject(projectData as ProjectRecord);
      setName((projectData?.name as string | undefined) ?? '');
      setDescription((projectData?.description as string | undefined) ?? '');
      setDashboardData({
        projectMembers: (memberData ?? []) as ProjectMember[],
        students: (studentData ?? []) as StudentProfile[],
        pendingInvitations: (invitationData ?? []) as ProjectInvitation[],
        announcements: (announcementData ?? []) as Announcement[],
        events,
        attendanceSessions,
        recentAttendanceSessions,
        attendanceEntries,
      });
    } catch (error) {
      console.error('Failed to load club overview', error);
      toast.error('Failed to load club overview');
    } finally {
      setLoading(false);
    }
  };

  // ─── Derived values ──────────────────────────────────────────────────────

  const collaboratorMembers = useMemo(
    () => dashboardData.projectMembers.filter((m) => m.role !== 'owner'),
    [dashboardData.projectMembers],
  );
  const collaboratorCount = collaboratorMembers.length;

  const publishedAnnouncementCount = useMemo(
    () =>
      dashboardData.announcements.filter((a) => a.status === 'published')
        .length,
    [dashboardData.announcements],
  );
  const draftAnnouncementCount = useMemo(
    () =>
      dashboardData.announcements.filter((a) => a.status === 'draft').length,
    [dashboardData.announcements],
  );
  const pinnedAnnouncementCount = useMemo(
    () => dashboardData.announcements.filter((a) => a.is_pinned).length,
    [dashboardData.announcements],
  );

  const nextEvents = useMemo(
    () =>
      [...dashboardData.events]
        .filter((e) => {
          const t = new Date(e.start_at).getTime();
          return (
            !Number.isNaN(t) && t >= Date.now() && e.status !== 'cancelled'
          );
        })
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
    [dashboardData.events],
  );

  const publicEventCount = useMemo(
    () => dashboardData.events.filter((e) => e.visibility === 'public').length,
    [dashboardData.events],
  );
  const privateEventCount = dashboardData.events.length - publicEventCount;

  const attendanceEntriesBySession = useMemo(() => {
    const map = new Map<string, AttendanceEntryRecord[]>();
    dashboardData.attendanceEntries.forEach((entry) => {
      const bucket = map.get(entry.session_id) ?? [];
      bucket.push(entry);
      map.set(entry.session_id, bucket);
    });
    return map;
  }, [dashboardData.attendanceEntries]);

  const attendanceChartData = useMemo<AttendanceChartRow[]>(() => {
    if (attendancePeriod === 'session') {
      return [...dashboardData.recentAttendanceSessions]
        .sort(
          (a, b) =>
            new Date(a.meeting_date).getTime() -
            new Date(b.meeting_date).getTime(),
        )
        .map((session) => {
          const entries = attendanceEntriesBySession.get(session.id) ?? [];
          let present = 0,
            late = 0,
            excused = 0,
            absent = 0,
            weightedAttendance = 0;
          entries.forEach((entry) => {
            const status = coerceAttendanceStatus(entry.status);
            weightedAttendance += getAttendanceWeight(status);
            if (status === 'present') present++;
            if (status === 'late') late++;
            if (status === 'excused') excused++;
            if (status === 'absent') absent++;
          });
          const attendees = entries.length;
          const rate =
            attendees > 0
              ? Math.round((weightedAttendance / attendees) * 100)
              : 0;
          return {
            session: formatSessionTick(session.meeting_date),
            fullLabel: session.title,
            dateLabel: formatReadableDate(session.meeting_date),
            present,
            late,
            excused,
            absent,
            attendees,
            rate,
          };
        });
    }

    const bucketKeyFor = (dateStr: string) => {
      const d = new Date(dateStr);
      if (attendancePeriod === 'daily') return d.toISOString().slice(0, 10);
      if (attendancePeriod === 'weekly') {
        const copy = new Date(d);
        copy.setHours(0, 0, 0, 0);
        copy.setDate(copy.getDate() - copy.getDay());
        return copy.toISOString().slice(0, 10);
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const map = new Map<
      string,
      {
        present: number;
        late: number;
        excused: number;
        absent: number;
        attendees: number;
        weightedAttendance: number;
        firstDate: string;
        titles: string[];
      }
    >();

    [...dashboardData.recentAttendanceSessions]
      .sort(
        (a, b) =>
          new Date(a.meeting_date).getTime() -
          new Date(b.meeting_date).getTime(),
      )
      .forEach((session) => {
        const key = bucketKeyFor(session.meeting_date);
        const bucket = map.get(key) ?? {
          present: 0,
          late: 0,
          excused: 0,
          absent: 0,
          attendees: 0,
          weightedAttendance: 0,
          firstDate: session.meeting_date,
          titles: [],
        };
        const entries = attendanceEntriesBySession.get(session.id) ?? [];
        entries.forEach((e) => {
          const status = coerceAttendanceStatus(e.status);
          bucket.weightedAttendance += getAttendanceWeight(status);
          if (status === 'present') bucket.present++;
          if (status === 'late') bucket.late++;
          if (status === 'excused') bucket.excused++;
          if (status === 'absent') bucket.absent++;
        });
        bucket.attendees += entries.length;
        bucket.titles.push(session.title);
        map.set(key, bucket);
      });

    const rows: AttendanceChartRow[] = [];
    Array.from(map.entries())
      .sort(
        (a, b) =>
          new Date(a[1].firstDate).getTime() -
          new Date(b[1].firstDate).getTime(),
      )
      .forEach(([, v]) => {
        const attendees = v.attendees;
        const rate =
          attendees > 0
            ? Math.round((v.weightedAttendance / attendees) * 100)
            : 0;
        let sessionLabel = '',
          dateLabel = '';
        if (attendancePeriod === 'daily') {
          sessionLabel = formatSessionTick(v.firstDate);
          dateLabel = formatReadableDate(v.firstDate);
        } else if (attendancePeriod === 'weekly') {
          const d = new Date(v.firstDate);
          const weekStart = new Date(d);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          sessionLabel = formatSessionTick(weekStart.toISOString());
          dateLabel = `Week of ${formatReadableDate(weekStart.toISOString())}`;
        } else {
          const d = new Date(v.firstDate);
          sessionLabel = `${d.toLocaleString(undefined, { month: 'short' })} ${d.getFullYear()}`;
          dateLabel = sessionLabel;
        }
        rows.push({
          session: sessionLabel,
          fullLabel: v.titles.join('; '),
          dateLabel,
          present: v.present,
          late: v.late,
          excused: v.excused,
          absent: v.absent,
          attendees,
          rate,
        });
      });
    return rows;
  }, [
    attendanceEntriesBySession,
    dashboardData.recentAttendanceSessions,
    attendancePeriod,
  ]);

  const attendanceRowsWithData = useMemo(
    () => attendanceChartData.filter((row) => row.attendees > 0),
    [attendanceChartData],
  );

  const averageAttendanceRate = useMemo(() => {
    if (attendanceRowsWithData.length === 0) return 0;
    return Math.round(
      attendanceRowsWithData.reduce((sum, row) => sum + row.rate, 0) /
        attendanceRowsWithData.length,
    );
  }, [attendanceRowsWithData]);

  const latestAttendanceRow =
    attendanceRowsWithData[attendanceRowsWithData.length - 1] ?? null;
  const previousAttendanceRow =
    attendanceRowsWithData[attendanceRowsWithData.length - 2] ?? null;
  const attendanceMomentum =
    latestAttendanceRow != null && previousAttendanceRow != null
      ? latestAttendanceRow.rate - previousAttendanceRow.rate
      : null;

  const recentSessionsWithoutEntries = useMemo(
    () =>
      dashboardData.recentAttendanceSessions.filter(
        (s) => (attendanceEntriesBySession.get(s.id) ?? []).length === 0,
      ),
    [attendanceEntriesBySession, dashboardData.recentAttendanceSessions],
  );

  const hasAttendanceData = attendanceRowsWithData.length > 0;
  const totalPeople = dashboardData.students.length + collaboratorCount;

  const eventsNext7Days = useMemo(
    () => nextEvents.filter((e) => isWithinDays(e.start_at, 7)),
    [nextEvents],
  );
  const eventsNext30Days = useMemo(
    () => nextEvents.filter((e) => isWithinDays(e.start_at, 30)),
    [nextEvents],
  );

  const activityTrendData = useMemo(
    () =>
      buildActivityTrendData(
        dashboardData.announcements,
        dashboardData.events,
        dashboardData.attendanceSessions,
      ),
    [
      dashboardData.announcements,
      dashboardData.attendanceSessions,
      dashboardData.events,
    ],
  );
  const hasActivityTrendData = activityTrendData.some((r) => r.total > 0);

  const attendanceMixData = useMemo(
    () => buildAttendanceMixData(attendanceRowsWithData),
    [attendanceRowsWithData],
  );
  const hasAttendanceMixData = attendanceMixData.some((i) => i.count > 0);

  const attendanceStatusTimelineData = useMemo<AttendanceStatusTimelineRow[]>(
    () =>
      attendanceChartData
        .map((row) => ({
          session: row.session,
          fullLabel: `${row.dateLabel}: ${row.fullLabel}`,
          present: row.present,
          late: row.late,
          excused: row.excused,
          absent: row.absent,
          total: row.present + row.late + row.excused + row.absent,
        }))
        .filter((row) => row.total > 0),
    [attendanceChartData],
  );
  const hasAttendanceTimelineData = attendanceStatusTimelineData.length > 0;

  const rosterGrowthData = useMemo(
    () => buildRosterGrowthData(dashboardData.students, collaboratorMembers),
    [collaboratorMembers, dashboardData.students],
  );
  const hasRosterGrowthData = rosterGrowthData.some((r) => r.totalPeople > 0);

  const announcementBreakdownData = useMemo(
    () =>
      buildAnnouncementBreakdownData({
        announcements: dashboardData.announcements,
        publishedCount: publishedAnnouncementCount,
        draftCount: draftAnnouncementCount,
        pinnedCount: pinnedAnnouncementCount,
      }),
    [
      dashboardData.announcements,
      draftAnnouncementCount,
      pinnedAnnouncementCount,
      publishedAnnouncementCount,
    ],
  );
  const hasAnnouncementBreakdownData = announcementBreakdownData.some(
    (r) => r.count > 0,
  );

  const recentPeopleCount =
    countRecentDates(
      dashboardData.students.map((s) => s.joined_at),
      30,
    ) +
    countRecentDates(
      collaboratorMembers.map((m) => m.joined_at ?? m.created_at),
      30,
    );

  const publicEventRatio =
    dashboardData.events.length > 0
      ? Math.round((publicEventCount / dashboardData.events.length) * 100)
      : 0;

  // Action items for the task queue
  const actionItems = useMemo(
    () => [
      {
        id: 'draft-announcements',
        title: 'Draft announcements',
        description:
          draftAnnouncementCount === 1
            ? '1 announcement is unpublished and waiting for review.'
            : `${draftAnnouncementCount} announcements are unpublished and waiting for review.`,
        href: `/home/projects/${projectId}/announcements`,
        count: draftAnnouncementCount,
        warn: true,
      },
      {
        id: 'pending-invitations',
        title: 'Pending invitations',
        description:
          dashboardData.pendingInvitations.length === 1
            ? '1 collaborator has been invited but has not yet joined.'
            : `${dashboardData.pendingInvitations.length} collaborators have been invited but have not yet joined.`,
        href: `/home/projects/${projectId}/members`,
        count: dashboardData.pendingInvitations.length,
        warn: true,
      },
      {
        id: 'sessions-missing-attendance',
        title: 'Sessions missing attendance',
        description:
          recentSessionsWithoutEntries.length === 1
            ? '1 recent meeting has no attendance logged.'
            : `${recentSessionsWithoutEntries.length} recent meetings have no attendance logged.`,
        href: `/home/projects/${projectId}/attendance/meetings`,
        count: recentSessionsWithoutEntries.length,
        warn: true,
      },
    ],
    [
      draftAnnouncementCount,
      dashboardData.pendingInvitations.length,
      recentSessionsWithoutEntries.length,
      projectId,
    ],
  );

  const dismissAction = (id: string) => {
    setDismissedActionIds((prev) => new Set([...prev, id]));
  };
  const undismissAction = (id: string) => {
    setDismissedActionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSaveChanges = async () => {
    if (!name.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from('projects')
        .update({ name, description })
        .eq('id', projectId)
        .select('id, name, description, status, created_at')
        .single();
      if (error) {
        console.error('Update error:', error);
        toast.error('Failed to update project');
        return;
      }
      setProject(data as ProjectRecord);
      setEditing(false);
      toast.success('Project updated successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || deleteConfirmInput !== project.name) {
      toast.error('Project name does not match');
      return;
    }
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete project');
        return;
      }
      toast.success('Project deleted');
      window.location.href = '/home';
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  const getShareUrl = (projId?: string) => {
    try {
      return `${window.location?.origin ?? ''}/home/projects/${projId ?? projectId}`;
    } catch {
      return `/home/projects/${projId ?? projectId}`;
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const nativeShare = async () => {
    const url = getShareUrl();
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: project?.name,
          text: project?.description ?? project?.name,
          url,
        });
      } catch {
        /* cancelled */
      }
    } else {
      toast('Sharing not supported on this device');
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
  };

  // ─── Early returns ────────────────────────────────────────────────────────

  if (loading) return <LoadingOverlay fullPage />;

  if (!project) {
    return (
      <div className="w-full">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const studentPct =
    totalPeople > 0
      ? Math.round((dashboardData.students.length / totalPeople) * 100)
      : 0;

  const attendanceDeltaDetail =
    attendanceMomentum != null
      ? formatDelta(attendanceMomentum)
      : latestAttendanceRow != null
        ? `${latestAttendanceRow.attendees} last session`
        : 'No attendance yet';

  const sessionsThisMonth = dashboardData.attendanceSessions.filter((s) => {
    const d = new Date(s.meeting_date);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

  return (
    <div className="w-full space-y-8 pb-16">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {project.name}
          </h1>
          <div className="flex items-start gap-1.5">
            <p className="text-muted-foreground mt-0.5 max-w-xl text-sm leading-relaxed">
              {project.description?.trim() ||
                'No description yet. Add one so members know what this club is about.'}
            </p>
            {!editing && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-6 w-6 shrink-0 rounded"
                asChild
              >
                <Link
                  href={`/home/projects/${projectId}/settings?focus=description`}
                >
                  <Pencil className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {!editing && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button asChild variant="outline" size="sm">
              <a
                href={`/site/${projectId}`}
                target="_blank"
                rel="noreferrer"
                className="gap-1.5"
              >
                Open site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/home/projects/${projectId}/editor`}>Edit club</Link>
            </Button>
            <Button
              size="sm"
              style={{ background: BLUE[600] }}
              className="border-0 text-white hover:opacity-90"
              onClick={() => setShareDialogOpen(true)}
            >
              Share
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Members"
          value={totalPeople}
          detail={
            recentPeopleCount > 0
              ? `+${recentPeopleCount} this month`
              : 'No new joins'
          }
          up={recentPeopleCount > 0}
        />
        <KpiCard
          label="Students"
          value={dashboardData.students.length}
          detail={`${studentPct}% of roster`}
        />
        <KpiCard
          label="Sessions This Month"
          value={sessionsThisMonth}
          detail={`${dashboardData.attendanceSessions.length} all time`}
        />
        <KpiCard
          label="Attendance Average"
          value={hasAttendanceData ? `${averageAttendanceRate}%` : 'N/A'}
          detail={attendanceDeltaDetail}
          up={attendanceMomentum != null ? attendanceMomentum > 0 : undefined}
          down={attendanceMomentum != null ? attendanceMomentum < 0 : undefined}
        />
      </div>

      {/* ── Action queue ───────────────────────────────────────────────────── */}
      <ActionCenter
        items={actionItems}
        dismissedIds={dismissedActionIds}
        onDismiss={dismissAction}
        onUndismiss={undismissAction}
        projectId={projectId}
      />

      {/* ── Attendance ─────────────────────────────────────────────────────── */}
      <SectionHeading>Attendance</SectionHeading>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Trend line */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">
                Attendance rate
              </CardTitle>
              <CardDescription className="text-xs">
                Weighted score across sessions
              </CardDescription>
            </div>
            <PeriodSelect
              value={attendancePeriod}
              onChange={setAttendancePeriod}
            />
          </CardHeader>
          <CardContent>
            {hasAttendanceData ? (
              <ChartContainer
                config={attendancePerformanceChartConfig}
                className="h-64 w-full"
              >
                <ComposedChart accessibilityLayer data={attendanceChartData}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={BLUE[500]}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor={BLUE[500]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    dataKey="session"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as
                            | { dateLabel?: string; fullLabel?: string }
                            | undefined;
                          return row
                            ? `${row.dateLabel} · ${row.fullLabel}`
                            : '';
                        }}
                      />
                    }
                  />
                  <Line
                    dataKey="rate"
                    type="monotone"
                    stroke={BLUE[500]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: BLUE[500], strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: BLUE[600] }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="No attendance entries yet. Start logging attendance." />
            )}
          </CardContent>
        </Card>

        {/* Status mix */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Status breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Present, late, excused, absent
                </CardDescription>
              </div>
              <PeriodSelect
                value={
                  attendancePeriod === 'session' ? 'weekly' : attendancePeriod
                }
                onChange={(v) =>
                  setAttendancePeriod(v as 'daily' | 'weekly' | 'monthly')
                }
                excludeSession
              />
            </div>
          </CardHeader>
          <CardContent>
            {hasAttendanceMixData ? (
              <ChartContainer
                config={attendanceMixChartConfig}
                className="h-64 w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={attendanceMixData}
                  layout="vertical"
                  margin={{ left: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => {
                          const row = (item as { payload?: AttendanceMixRow })
                            .payload;
                          return (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                {row?.label ?? 'Status'}
                              </span>
                              <span className="font-medium tabular-nums">
                                {Number(value).toLocaleString()}
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={6}>
                    {attendanceMixData.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="No attendance data yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session composition stacked bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Session composition
          </CardTitle>
          <CardDescription className="text-xs">
            Status breakdown per session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasAttendanceTimelineData ? (
            <ChartContainer
              config={attendanceStatusTimelineChartConfig}
              className="h-56 w-full"
            >
              <BarChart accessibilityLayer data={attendanceStatusTimelineData}>
                <CartesianGrid
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                />
                <XAxis
                  dataKey="session"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as
                          | { fullLabel?: string }
                          | undefined;
                        return row?.fullLabel ?? '';
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="present"
                  stackId="a"
                  fill={STATUS_COLORS.present}
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="late" stackId="a" fill={STATUS_COLORS.late} />
                <Bar
                  dataKey="excused"
                  stackId="a"
                  fill={STATUS_COLORS.excused}
                />
                <Bar dataKey="absent" stackId="a" fill={STATUS_COLORS.absent} />
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartEmpty message="No session breakdown yet." />
          )}
          {hasAttendanceTimelineData && (
            <div className="mt-3 flex flex-wrap gap-4">
              {[
                { label: 'Present', color: STATUS_COLORS.present },
                { label: 'Late', color: STATUS_COLORS.late },
                { label: 'Excused', color: STATUS_COLORS.excused },
                { label: 'Absent', color: STATUS_COLORS.absent },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className="text-muted-foreground flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: color }}
                  />
                  {label}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Roster & Growth ────────────────────────────────────────────────── */}
      <SectionHeading>Roster &amp; Growth</SectionHeading>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Roster growth
            </CardTitle>
            <CardDescription className="text-xs">
              Cumulative students and collaborators over 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRosterGrowthData ? (
              <ChartContainer
                config={rosterGrowthChartConfig}
                className="h-56 w-full"
              >
                <ComposedChart accessibilityLayer data={rosterGrowthData}>
                  <CartesianGrid
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as
                            | { fullLabel?: string }
                            | undefined;
                          return row?.fullLabel ?? '';
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="students"
                    fill={BLUE[400]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey="collaborators"
                    fill={BLUE[200]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                  />
                  <Line
                    dataKey="totalPeople"
                    type="monotone"
                    stroke={BLUE[600]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: BLUE[600], strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="No roster growth data yet." />
            )}
            {hasRosterGrowthData && (
              <div className="mt-3 flex flex-wrap gap-4">
                {[
                  { label: 'Students', color: BLUE[400] },
                  { label: 'Collaborators', color: BLUE[200] },
                  { label: 'Total', color: BLUE[600] },
                ].map(({ label, color }) => (
                  <span
                    key={label}
                    className="text-muted-foreground flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ background: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Roster snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Roster snapshot
            </CardTitle>
            <CardDescription className="text-xs">
              Current membership at a glance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Students</span>
                <span className="font-medium">
                  {dashboardData.students.length} ({studentPct}%)
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${studentPct}%`, background: BLUE[500] }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Collaborators</span>
                <span className="font-medium">
                  {collaboratorCount} ({100 - studentPct}%)
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${100 - studentPct}%`,
                    background: BLUE[300],
                  }}
                />
              </div>
            </div>

            <div className="space-y-2.5 border-t pt-4">
              <StatRow
                label="New joins (30 days)"
                value={`+${recentPeopleCount}`}
                positive={recentPeopleCount > 0}
              />
              <StatRow
                label="Pending invites"
                value={dashboardData.pendingInvitations.length}
                warn={dashboardData.pendingInvitations.length > 0}
              />
              <StatRow label="Total roster" value={totalPeople} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Activity ───────────────────────────────────────────────────────── */}
      <SectionHeading>Activity</SectionHeading>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Monthly activity
            </CardTitle>
            <CardDescription className="text-xs">
              Announcements, events, and sessions over 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasActivityTrendData ? (
              <ChartContainer
                config={activityTrendChartConfig}
                className="h-56 w-full"
              >
                <ComposedChart accessibilityLayer data={activityTrendData}>
                  <CartesianGrid
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as
                            | { fullLabel?: string }
                            | undefined;
                          return row?.fullLabel ?? '';
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="announcements"
                    fill={BLUE[300]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="events"
                    fill={BLUE[500]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="sessions"
                    fill={BLUE[700]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Line
                    dataKey="total"
                    type="monotone"
                    stroke={BLUE[500]}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: BLUE[500], strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="No activity trend data yet." />
            )}
            {hasActivityTrendData && (
              <div className="mt-3 flex flex-wrap gap-4">
                {[
                  { label: 'Announcements', color: BLUE[300] },
                  { label: 'Events', color: BLUE[500] },
                  { label: 'Sessions', color: BLUE[700] },
                ].map(({ label, color }) => (
                  <span
                    key={label}
                    className="text-muted-foreground flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ background: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Announcement breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Announcements
                </CardTitle>
                <CardDescription className="text-xs">
                  Published, draft, and pinned distribution
                </CardDescription>
              </div>
              <span className="text-muted-foreground text-xs">
                {dashboardData.announcements.length} total
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {hasAnnouncementBreakdownData ? (
              <ChartContainer
                config={announcementBreakdownChartConfig}
                className="h-56 w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={announcementBreakdownData}
                  layout="vertical"
                  margin={{ left: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => {
                          const row = (
                            item as { payload?: AnnouncementBreakdownRow }
                          ).payload;
                          return (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                {row?.label ?? 'State'}
                              </span>
                              <span className="font-medium tabular-nums">
                                {Number(value).toLocaleString()}
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={6}>
                    {announcementBreakdownData.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty message="No announcement data yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Events & Schedule ──────────────────────────────────────────────── */}
      <SectionHeading>Events &amp; Schedule</SectionHeading>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Upcoming events */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Upcoming schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Next events sorted by date
                </CardDescription>
              </div>
              <div className="text-muted-foreground flex gap-3 text-xs">
                <span>
                  <span className="text-foreground font-medium">
                    {eventsNext7Days.length}
                  </span>{' '}
                  this week
                </span>
                <span>
                  <span className="text-foreground font-medium">
                    {eventsNext30Days.length}
                  </span>{' '}
                  this month
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {nextEvents.length === 0 ? (
              <ChartEmpty message="No upcoming events." className="h-48" />
            ) : (
              nextEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="hover:bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-2.5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {event.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatShortDate(event.start_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-3 shrink-0 text-xs',
                      event.visibility === 'public'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : '',
                    )}
                  >
                    {formatStatus(event.visibility)}
                  </Badge>
                </div>
              ))
            )}
            {nextEvents.length > 8 && (
              <Link
                href={`/home/projects/${projectId}/events`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1 text-xs transition-colors"
              >
                View all {nextEvents.length} events{' '}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Event visibility stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Visibility split
            </CardTitle>
            <CardDescription className="text-xs">
              Public vs private event ratio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Public</span>
                <span className="font-medium">
                  {publicEventCount} ({publicEventRatio}%)
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${publicEventRatio}%`,
                    background: BLUE[500],
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Private</span>
                <span className="font-medium">
                  {privateEventCount} ({100 - publicEventRatio}%)
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-muted-foreground/30 h-full rounded-full"
                  style={{ width: `${100 - publicEventRatio}%` }}
                />
              </div>
            </div>
            <div className="space-y-2.5 border-t pt-4">
              <StatRow
                label="Total events"
                value={dashboardData.events.length}
              />
              <StatRow label="Next 7 days" value={eventsNext7Days.length} />
              <StatRow label="Next 30 days" value={eventsNext30Days.length} />
              <StatRow label="Public share" value={`${publicEventRatio}%`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Edit form ──────────────────────────────────────────────────────── */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit club</CardTitle>
            <CardDescription>
              Update the basics that appear throughout the club dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Club name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Club name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Club description"
                rows={4}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={handleSaveChanges}
                disabled={saving}
                style={{ background: BLUE[600] }}
                className="border-0 text-white hover:opacity-90"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                onClick={cancelEditing}
                variant="outline"
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Share dialog ───────────────────────────────────────────────────── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share club</DialogTitle>
            <DialogDescription>
              Share a link to this club or copy the URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={getShareUrl()} />
              <Button variant="outline" onClick={() => void copyShareLink()}>
                Copy
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void nativeShare()}>Share</Button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${project?.name ?? ''} ${getShareUrl()}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline">X / Twitter</Button>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline">Facebook</Button>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline">LinkedIn</Button>
              </a>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <img
                alt="QR code"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getShareUrl())}`}
                className="rounded-md border"
              />
              <p className="text-muted-foreground text-sm">
                Scan this QR code to open the club page.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ──────────────────────────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete club</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type the club name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Club name to confirm</Label>
              <p className="bg-muted rounded-lg px-3 py-2 text-sm font-semibold">
                {project.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type the club name</Label>
              <Input
                id="delete-confirm"
                placeholder="Enter club name"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleting || deleteConfirmInput !== project.name}
            >
              {deleting ? 'Deleting...' : 'Delete club'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Action Center ────────────────────────────────────────────────────────────

function ActionCenter({
  items,
  dismissedIds,
  onDismiss,
  onUndismiss,
  projectId,
}: {
  items: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    count: number;
    warn: boolean;
  }>;
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  onUndismiss: (id: string) => void;
  projectId: string;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const visible = items.filter(
    (item) => !dismissedIds.has(item.id) && item.count > 0,
  );
  const dismissed = items.filter(
    (item) => dismissedIds.has(item.id) && item.count > 0,
  );

  if (visible.length === 0 && !showDismissed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            You're all caught up
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            No pending actions right now. Check back after your next session.
          </p>
          {dismissed.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowDismissed(true)}
              className="mt-2 text-xs font-medium text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              Show dismissed ({dismissed.length})
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-center justify-between border-b bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold">Action needed</p>
        </div>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          {visible.length}
        </span>
      </div>
      <div className="divide-y">
        {visible.map((item) => (
          <div
            key={item.id}
            className="hover:bg-muted/30 flex items-center gap-4 px-5 py-3.5 transition-colors"
          >
            <div
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                item.warn ? 'bg-amber-400' : 'bg-blue-400',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {item.description}
              </p>
            </div>
            <span
              className={cn(
                'flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
                item.warn
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.count}
            </span>
            <Link
              href={item.href}
              className="flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors"
              style={{ color: BLUE[600] }}
            >
              View <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => onDismiss(item.id)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
              aria-label={`Dismiss ${item.title}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {showDismissed && dismissed.map((item) => (
          <div
            key={item.id}
            className="bg-muted/20 flex items-center gap-4 px-5 py-3.5 opacity-80"
          >
            <div className="bg-muted-foreground/50 h-2 w-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {item.description}
              </p>
            </div>
            <span className="bg-muted text-muted-foreground flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums">
              {item.count}
            </span>
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors"
            >
              View <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => onUndismiss(item.id)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
              aria-label={`Undismiss ${item.title}`}
            >
              Undismiss
            </button>
          </div>
        ))}
      </div>
      {dismissed.length > 0 ? (
        <div className="border-t px-5 py-2.5">
          <button
            type="button"
            onClick={() => setShowDismissed((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground text-xs font-medium underline underline-offset-2 transition-colors"
          >
            {showDismissed
              ? `Hide dismissed (${dismissed.length})`
              : `Show dismissed (${dismissed.length})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Small shared components ──────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="text-foreground shrink-0 text-sm font-semibold">
        {children}
      </h2>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  up,
  down,
}: {
  label: string;
  value: string | number;
  detail: string;
  up?: boolean;
  down?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3.5 shadow-sm">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p
        className={cn(
          'mt-0.5 flex items-center gap-0.5 text-[11px]',
          up
            ? 'text-emerald-600 dark:text-emerald-400'
            : down
              ? 'text-red-500'
              : 'text-muted-foreground',
        )}
      >
        {up && <TrendingUp className="h-3 w-3" />}
        {down && <TrendingDown className="h-3 w-3" />}
        {detail}
      </p>
    </div>
  );
}

function ChartEmpty({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-center text-sm',
        className,
      )}
    >
      {message}
    </div>
  );
}

function StatRow({
  label,
  value,
  positive,
  warn,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-medium tabular-nums',
          positive
            ? 'text-emerald-600 dark:text-emerald-400'
            : warn
              ? 'text-amber-600 dark:text-amber-400'
              : '',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PeriodSelect({
  value,
  onChange,
  excludeSession,
}: {
  value: string;
  onChange: (v: 'session' | 'daily' | 'weekly' | 'monthly') => void;
  excludeSession?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value as 'session' | 'daily' | 'weekly' | 'monthly')
      }
      className="text-muted-foreground rounded-md border bg-transparent px-2 py-1 text-xs focus:outline-none"
    >
      {!excludeSession && <option value="session">By session</option>}
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
    </select>
  );
}

// ─── Data builders ────────────────────────────────────────────────────────────

function buildActivityTrendData(
  announcements: Announcement[],
  events: EventRecord[],
  sessions: AttendanceSessionRecord[],
): ActivityTrendRow[] {
  const months = buildRecentMonthBuckets(6);
  const byMonth = new Map(
    months.map((row) => [
      row.key,
      { ...row, announcements: 0, events: 0, sessions: 0, total: 0 },
    ]),
  );

  announcements.forEach((a) => {
    const key = monthKeyFromValue(a.published_at ?? a.created_at);
    if (!key) return;
    const row = byMonth.get(key);
    if (!row) return;
    row.announcements++;
    row.total++;
  });
  events.forEach((e) => {
    const key = monthKeyFromValue(e.start_at ?? e.created_at);
    if (!key) return;
    const row = byMonth.get(key);
    if (!row) return;
    row.events++;
    row.total++;
  });
  sessions.forEach((s) => {
    const key = monthKeyFromValue(s.created_at ?? s.meeting_date);
    if (!key) return;
    const row = byMonth.get(key);
    if (!row) return;
    row.sessions++;
    row.total++;
  });

  return months.map((m) => byMonth.get(m.key)!);
}

function buildAttendanceMixData(
  rows: AttendanceChartRow[],
): AttendanceMixRow[] {
  const totals = rows.reduce(
    (acc, row) => {
      acc.present += row.present;
      acc.late += row.late;
      acc.excused += row.excused;
      acc.absent += row.absent;
      return acc;
    },
    { present: 0, late: 0, excused: 0, absent: 0 },
  );
  return [
    {
      key: 'present',
      label: 'Present',
      count: totals.present,
      fill: STATUS_COLORS.present,
    },
    {
      key: 'late',
      label: 'Late',
      count: totals.late,
      fill: STATUS_COLORS.late,
    },
    {
      key: 'excused',
      label: 'Excused',
      count: totals.excused,
      fill: STATUS_COLORS.excused,
    },
    {
      key: 'absent',
      label: 'Absent',
      count: totals.absent,
      fill: STATUS_COLORS.absent,
    },
  ];
}

function buildRosterGrowthData(
  students: StudentProfile[],
  collaborators: ProjectMember[],
): RosterGrowthRow[] {
  return buildRecentMonthBuckets(6).map((month) => {
    const monthEnd = endOfMonthFromKey(month.key);
    const studentsCount = students.filter((s) => {
      const t = parseDateValue(s.joined_at);
      return t != null && t <= monthEnd.getTime();
    }).length;
    const collaboratorsCount = collaborators.filter((m) => {
      const t = parseDateValue(m.joined_at ?? m.created_at);
      return t != null && t <= monthEnd.getTime();
    }).length;
    return {
      ...month,
      students: studentsCount,
      collaborators: collaboratorsCount,
      totalPeople: studentsCount + collaboratorsCount,
    };
  });
}

function buildAnnouncementBreakdownData({
  announcements,
  publishedCount,
  draftCount,
  pinnedCount,
}: {
  announcements: Announcement[];
  publishedCount: number;
  draftCount: number;
  pinnedCount: number;
}): AnnouncementBreakdownRow[] {
  const otherCount = Math.max(
    announcements.length - publishedCount - draftCount,
    0,
  );
  return [
    {
      key: 'published',
      label: 'Published',
      count: publishedCount,
      fill: BLUE[600],
    },
    { key: 'draft', label: 'Drafts', count: draftCount, fill: '#d97706' },
    { key: 'pinned', label: 'Pinned', count: pinnedCount, fill: BLUE[400] },
    { key: 'other', label: 'Other', count: otherCount, fill: '#9ca3af' },
  ];
}

// ─── Utility functions ────────────────────────────────────────────────────────

function buildRecentMonthBuckets(length: number) {
  const short = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const long = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  });
  return Array.from({ length }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - (length - 1 - i));
    return {
      key: monthKeyFromDate(d),
      month: short.format(d),
      fullLabel: long.format(d),
    };
  });
}

function endOfMonthFromKey(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
}

function monthKeyFromValue(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : monthKeyFromDate(d);
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function countRecentDates(
  values: Array<string | null | undefined>,
  days: number,
) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return values.reduce((count, v) => {
    const t = parseDateValue(v ?? null);
    return t != null && t >= cutoff ? count + 1 : count;
  }, 0);
}

function isWithinDays(value: string | null, days: number) {
  const t = parseDateValue(value);
  if (t == null) return false;
  const now = Date.now();
  return t >= now && t <= now + days * 24 * 60 * 60 * 1000;
}

function parseDateValue(value: string | null) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatSessionTick(dateValue: string) {
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime())
    ? dateValue
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatShortDate(value: string | null) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Unknown'
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

function formatStatus(value: string | null | undefined) {
  if (!value) return 'Active';
  return value
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function formatDelta(value: number) {
  if (value === 0) return 'No change';
  return `${value > 0 ? '+' : ''}${value} pts vs prev`;
}
