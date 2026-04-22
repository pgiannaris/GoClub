'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
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

type ActivityChartRow = {
  key: string;
  month: string;
  fullLabel: string;
  announcements: number;
  events: number;
  sessions: number;
  total: number;
};

type GrowthChartRow = {
  key: string;
  month: string;
  fullLabel: string;
  students: number;
  collaborators: number;
  totalPeople: number;
};

type PipelineRow = {
  key: string;
  label: string;
  value: number;
  fill: string;
};

type AnnouncementStatusRow = {
  key: string;
  label: string;
  value: number;
  fill: string;
};

type WeeklyEventsRow = {
  key: string;
  week: string;
  fullLabel: string;
  publicEvents: number;
  privateEvents: number;
  total: number;
};

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

const attendancePerformanceChartConfig = {
  attendees: { label: 'Attendees', color: 'var(--chart-2)' },
  rate: { label: 'Attendance Rate', color: 'var(--primary)' },
} satisfies ChartConfig;

const activityChartConfig = {
  announcements: { label: 'Announcements', color: 'var(--primary)' },
  events: { label: 'Events', color: 'var(--chart-2)' },
  sessions: { label: 'Meetings', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const growthChartConfig = {
  totalPeople: { label: 'People', color: 'var(--primary)' },
  students: { label: 'Students', color: 'var(--chart-2)' },
  collaborators: { label: 'Collaborators', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const pipelineChartConfig = {
  value: { label: 'Count', color: 'var(--primary)' },
} satisfies ChartConfig;

const announcementStatusChartConfig = {
  published: { label: 'Published', color: 'var(--primary)' },
  draft: { label: 'Drafts', color: 'var(--chart-5)' },
  other: { label: 'Other', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const upcomingEventsChartConfig = {
  publicEvents: { label: 'Public', color: 'var(--primary)' },
  privateEvents: { label: 'Private', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function ProjectDetailContent({
  user,
  projectId,
}: {
  user: unknown;
  projectId: string;
}) {
  const supabase = useSupabase();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadProjectOverview();
  }, [projectId]);

  const loadProjectOverview = async () => {
    setLoading(true);

    try {
      const eventsPromise = fetch(`/api/projects/${encodeURIComponent(projectId)}/events`, {
        credentials: 'include',
      }).then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          events?: EventRecord[];
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load events');
        }

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

      const attendanceSessions = (sessionData ?? []) as AttendanceSessionRecord[];
      const recentAttendanceSessions = attendanceSessions.slice(0, 8);
      const sessionIds = recentAttendanceSessions.map((session) => session.id);

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

  const collaboratorMembers = useMemo(
    () => dashboardData.projectMembers.filter((member) => member.role !== 'owner'),
    [dashboardData.projectMembers],
  );

  const collaboratorCount = collaboratorMembers.length;

  const publishedAnnouncementCount = useMemo(
    () => dashboardData.announcements.filter((announcement) => announcement.status === 'published').length,
    [dashboardData.announcements],
  );

  const draftAnnouncementCount = useMemo(
    () => dashboardData.announcements.filter((announcement) => announcement.status === 'draft').length,
    [dashboardData.announcements],
  );

  const pinnedAnnouncementCount = useMemo(
    () => dashboardData.announcements.filter((announcement) => announcement.is_pinned).length,
    [dashboardData.announcements],
  );

  const nextEvents = useMemo(
    () =>
      [...dashboardData.events]
        .filter((event) => {
          const startTime = new Date(event.start_at).getTime();
          return !Number.isNaN(startTime) && startTime >= Date.now() && event.status !== 'cancelled';
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [dashboardData.events],
  );

  const publicEventCount = useMemo(
    () => dashboardData.events.filter((event) => event.visibility === 'public').length,
    [dashboardData.events],
  );

  const privateEventCount = dashboardData.events.length - publicEventCount;

  const publicSessionCount = useMemo(
    () => dashboardData.attendanceSessions.filter((session) => session.is_public).length,
    [dashboardData.attendanceSessions],
  );

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
    return [...dashboardData.recentAttendanceSessions]
      .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
      .map((session) => {
        const sessionEntries = attendanceEntriesBySession.get(session.id) ?? [];

        let present = 0;
        let late = 0;
        let excused = 0;
        let absent = 0;
        let weightedAttendance = 0;

        sessionEntries.forEach((entry) => {
          const status = coerceAttendanceStatus(entry.status);
          weightedAttendance += getAttendanceWeight(status);

          if (status === 'present') present += 1;
          if (status === 'late') late += 1;
          if (status === 'excused') excused += 1;
          if (status === 'absent') absent += 1;
        });

        const attendees = sessionEntries.length;
        const rate = attendees > 0 ? Math.round((weightedAttendance / attendees) * 100) : 0;

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
  }, [attendanceEntriesBySession, dashboardData.recentAttendanceSessions]);

  const attendanceRowsWithData = useMemo(
    () => attendanceChartData.filter((row) => row.attendees > 0),
    [attendanceChartData],
  );

  const averageAttendanceRate = useMemo(() => {
    if (attendanceRowsWithData.length === 0) return 0;

    return Math.round(
      attendanceRowsWithData.reduce((sum, row) => sum + row.rate, 0) / attendanceRowsWithData.length,
    );
  }, [attendanceRowsWithData]);

  const latestAttendanceRow = attendanceRowsWithData[attendanceRowsWithData.length - 1] ?? null;
  const previousAttendanceRow = attendanceRowsWithData[attendanceRowsWithData.length - 2] ?? null;
  const attendanceMomentum =
    latestAttendanceRow != null && previousAttendanceRow != null
      ? latestAttendanceRow.rate - previousAttendanceRow.rate
      : null;

  const recentSessionsWithoutEntries = useMemo(
    () =>
      dashboardData.recentAttendanceSessions.filter(
        (session) => (attendanceEntriesBySession.get(session.id) ?? []).length === 0,
      ),
    [attendanceEntriesBySession, dashboardData.recentAttendanceSessions],
  );

  const activityChartData = useMemo(
    () =>
      buildActivityChartData(
        dashboardData.announcements,
        dashboardData.events,
        dashboardData.attendanceSessions,
      ),
    [dashboardData.announcements, dashboardData.attendanceSessions, dashboardData.events],
  );

  const growthChartData = useMemo(
    () => buildGrowthChartData(dashboardData.students, collaboratorMembers),
    [collaboratorMembers, dashboardData.students],
  );

  const publishingPipelineData = useMemo(
    () =>
      buildPublishingPipelineData({
        publishedAnnouncements: publishedAnnouncementCount,
        draftAnnouncements: draftAnnouncementCount,
        publicEvents: publicEventCount,
        privateEvents: privateEventCount,
        publicMeetings: publicSessionCount,
        pendingInvites: dashboardData.pendingInvitations.length,
      }),
    [
      dashboardData.pendingInvitations.length,
      draftAnnouncementCount,
      privateEventCount,
      publicEventCount,
      publicSessionCount,
      publishedAnnouncementCount,
    ],
  );

  const announcementStatusData = useMemo(
    () =>
      buildAnnouncementStatusData({
        total: dashboardData.announcements.length,
        published: publishedAnnouncementCount,
        drafts: draftAnnouncementCount,
      }),
    [dashboardData.announcements.length, draftAnnouncementCount, publishedAnnouncementCount],
  );

  const weeklyUpcomingEventsData = useMemo(
    () => buildWeeklyUpcomingEventsData(nextEvents, 6),
    [nextEvents],
  );

  const hasAttendanceData = attendanceRowsWithData.length > 0;
  const hasActivityData = activityChartData.some((row) => row.total > 0);
  const hasGrowthData = growthChartData.some((row) => row.totalPeople > 0);
  const hasUpcomingEventsData = weeklyUpcomingEventsData.some((row) => row.total > 0);

  const publicSurfaceCount = publishedAnnouncementCount + publicEventCount + publicSessionCount;
  const totalTrackedSurfaceCount =
    dashboardData.announcements.length + dashboardData.events.length + dashboardData.attendanceSessions.length;
  const publicSurfaceRate =
    totalTrackedSurfaceCount > 0 ? Math.round((publicSurfaceCount / totalTrackedSurfaceCount) * 100) : 0;

  const eventsNext30Days = useMemo(
    () => nextEvents.filter((event) => isWithinDays(event.start_at, 30)),
    [nextEvents],
  );

  const recentPeopleCount =
    countRecentDates(dashboardData.students.map((student) => student.joined_at), 30) +
    countRecentDates(
      collaboratorMembers.map((member) => member.joined_at || member.created_at),
      30,
    );

  const actionItemsCount =
    draftAnnouncementCount +
    dashboardData.pendingInvitations.length +
    recentSessionsWithoutEntries.length;

  const overviewSummary = useMemo(
    () =>
      buildOverviewSummary({
        clubName: project?.name || 'This club',
        studentCount: dashboardData.students.length,
        collaboratorCount,
        announcementCount: publishedAnnouncementCount,
        eventCount: nextEvents.length,
      }),
    [
      collaboratorCount,
      dashboardData.students.length,
      nextEvents.length,
      project?.name,
      publishedAnnouncementCount,
    ],
  );

  const summaryCards = [
    {
      label: 'Status',
      value: formatStatus(project?.status),
      detail: `${dashboardData.students.length + collaboratorCount} people`,
    },
    {
      label: 'Public',
      value: publicSurfaceCount,
      detail: `${publicSurfaceRate}% live`,
    },
    {
      label: 'Attendance',
      value: hasAttendanceData ? `${averageAttendanceRate}%` : '--',
      detail: latestAttendanceRow?.fullLabel || 'No sessions',
    },
    {
      label: 'Next Event',
      value: nextEvents[0] ? formatShortDate(nextEvents[0].start_at) : 'None',
      detail: nextEvents[0]?.title || 'No event scheduled',
    },
  ];

  const handleSaveChanges = async () => {
    if (!name.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await (supabase as any)
        .from('projects')
        .update({
          name,
          description,
        })
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
      const { error } = await (supabase as any).from('projects').delete().eq('id', projectId);

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

  const cancelEditing = () => {
    setEditing(false);
    setName(project?.name ?? '');
    setDescription(project?.description ?? '');
  };

  const openDeleteModal = () => {
    setDeleteModalOpen(true);
    setDeleteConfirmInput('');
  };

  if (loading) {
    return <LoadingOverlay fullPage />;
  }

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

  const statCards = [
    {
      label: 'Students',
      value: dashboardData.students.length,
      detail:
        recentPeopleCount > 0 ? `+${recentPeopleCount} in 30d` : 'No recent growth',
    },
    {
      label: 'Collaborators',
      value: collaboratorCount,
      detail:
        dashboardData.pendingInvitations.length > 0
          ? `${dashboardData.pendingInvitations.length} pending`
          : 'No pending',
    },
    {
      label: 'Attendance',
      value: `${averageAttendanceRate}%`,
      detail:
        attendanceMomentum != null
          ? formatDelta(attendanceMomentum)
          : latestAttendanceRow != null
            ? `${latestAttendanceRow.attendees} attendees`
            : 'No data',
    },
    {
      label: 'Upcoming Events',
      value: nextEvents.length,
      detail:
        nextEvents[0] != null
          ? formatShortDate(nextEvents[0].start_at)
          : 'None',
    },
    {
      label: 'Public',
      value: `${publicSurfaceRate}%`,
      detail: `${publicSurfaceCount} items`,
    },
    {
      label: 'Queue',
      value: actionItemsCount,
      detail:
        actionItemsCount > 0
          ? `${actionItemsCount} open`
          : 'Clear',
    },
  ];

  return (
    <div className="w-full space-y-4 pb-8 font-sans">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn('bg-background/80', projectStatusClass(project.status))}>
                    {formatStatus(project.status)}
                  </Badge>
                  <Badge variant="outline" className="bg-background/80">
                    {publicSurfaceCount} live
                  </Badge>
                  {pinnedAnnouncementCount > 0 ? (
                    <Badge variant="outline" className="bg-background/80">
                      {pinnedAnnouncementCount} pinned
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-3xl tracking-tight sm:text-4xl">{project.name}</CardTitle>
                  <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                    {overviewSummary}
                  </CardDescription>
                </div>
              </div>

              {!editing && (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                  <Button asChild variant="secondary" size="sm">
                    <a
                      href={`/site/${projectId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="gap-2"
                    >
                      Open site
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/home/projects/${projectId}/editor`}>Edit</Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <HeroMetric key={item.label} label={item.label} value={item.value} detail={item.detail} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>{project.id}</span>
              <span>{formatShortDate(project.created_at)}</span>
              <span>{getUserEmail(user)}</span>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-5 pb-0">
            <div>
              <CardTitle className="text-base">Upcoming Schedule</CardTitle>
              <CardDescription>Next six weeks.</CardDescription>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <HeaderStat label="30d" value={eventsNext30Days.length} />
              <HeaderStat label="Public" value={publicEventCount} />
              <HeaderStat label="Private" value={privateEventCount} />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            {hasUpcomingEventsData ? (
              <ChartContainer
                config={upcomingEventsChartConfig}
                className="h-64 w-full"
                responsiveProps={{ debounce: 180 }}
              >
                <BarChart accessibilityLayer data={weeklyUpcomingEventsData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                          return row?.fullLabel ?? '';
                        }}
                      />
                    }
                  />
                  <Bar dataKey="publicEvents" stackId="events" fill="var(--color-publicEvents)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="privateEvents" stackId="events" fill="var(--color-privateEvents)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState message="No upcoming events." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
        {statCards.map((card) => (
          <OverviewStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-5 pb-0">
            <div>
              <CardTitle>Attendance Performance</CardTitle>
              <CardDescription>Attendance volume and rate.</CardDescription>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <HeaderStat label="Recent meetings" value={dashboardData.recentAttendanceSessions.length} />
              <HeaderStat label="Average rate" value={`${averageAttendanceRate}%`} />
            </div>
          </CardHeader>
          <CardContent>
            {hasAttendanceData ? (
              <ChartContainer
                config={attendancePerformanceChartConfig}
                className="h-64 w-full"
                responsiveProps={{ debounce: 180 }}
              >
                <ComposedChart accessibilityLayer data={attendanceChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="session" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    yAxisId="count"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as
                            | { dateLabel?: string; fullLabel?: string }
                            | undefined;

                          if (!row) return '';
                          return `${row.dateLabel} - ${row.fullLabel}`;
                        }}
                      />
                    }
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="attendees"
                    fill="var(--color-attendees)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={34}
                  />
                  <Line
                    yAxisId="rate"
                    dataKey="rate"
                    type="monotone"
                    stroke="var(--color-rate)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: 'var(--color-rate)' }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState message="No attendance entries yet. Start logging meetings to populate this chart." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-5 pb-0">
            <div>
              <CardTitle>Activity Flow</CardTitle>
              <CardDescription>Six-month content volume.</CardDescription>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {activityChartData.reduce((sum, row) => sum + row.total, 0)}
            </div>
          </CardHeader>
          <CardContent>
            {hasActivityData ? (
              <ChartContainer
                config={activityChartConfig}
                className="h-64 w-full"
                responsiveProps={{ debounce: 180 }}
              >
                <BarChart accessibilityLayer data={activityChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                          return row?.fullLabel ?? '';
                        }}
                      />
                    }
                  />
                  <Bar dataKey="announcements" fill="var(--color-announcements)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="events" fill="var(--color-events)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState message="No activity yet." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-5 pb-0">
            <div>
              <CardTitle>Publishing Mix</CardTitle>
              <CardDescription>Publishing and access counts.</CardDescription>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {publishingPipelineData.reduce((sum, row) => sum + row.value, 0)}
            </div>
          </CardHeader>
          <CardContent>
            {publishingPipelineData.some((row) => row.value > 0) ? (
              <ChartContainer
                config={pipelineChartConfig}
                className="h-64 w-full"
                responsiveProps={{ debounce: 180 }}
              >
                <BarChart accessibilityLayer data={publishingPipelineData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={92} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {((item as { payload?: PipelineRow }).payload?.label ?? 'Item')}
                            </span>
                            <span className="font-medium tabular-nums">
                              {Number(value).toLocaleString()}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={8}>
                    {publishingPipelineData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState message="No publishing data." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-5 pb-0">
            <div>
              <CardTitle>Roster Growth</CardTitle>
              <CardDescription>Six-month roster growth.</CardDescription>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {dashboardData.students.length + collaboratorCount}
            </div>
          </CardHeader>
          <CardContent>
            {hasGrowthData ? (
              <ChartContainer
                config={growthChartConfig}
                className="h-64 w-full"
                responsiveProps={{ debounce: 180 }}
              >
                <ComposedChart accessibilityLayer data={growthChartData}>
                  <defs>
                    <linearGradient id="growth-total-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-totalPeople)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--color-totalPeople)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                          return row?.fullLabel ?? '';
                        }}
                      />
                    }
                  />
                  <Area
                    dataKey="totalPeople"
                    type="monotone"
                    fill="url(#growth-total-fill)"
                    stroke="var(--color-totalPeople)"
                    strokeWidth={2.5}
                  />
                  <Line dataKey="students" type="monotone" stroke="var(--color-students)" strokeWidth={2} dot={false} />
                  <Line
                    dataKey="collaborators"
                    type="monotone"
                    stroke="var(--color-collaborators)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState message="No growth data." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="p-5 pb-0">
            <CardTitle>Announcement Status</CardTitle>
            <CardDescription>Current announcement mix.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-3">
            {announcementStatusData.some((item) => item.value > 0) ? (
              <>
                <ChartContainer
                  config={announcementStatusChartConfig}
                  className="mx-auto h-52 w-full max-w-[220px]"
                  responsiveProps={{ debounce: 180 }}
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name, item) => (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                {announcementStatusChartConfig[name as keyof typeof announcementStatusChartConfig]?.label ??
                                  item.name}
                              </span>
                              <span className="font-medium tabular-nums">{Number(value).toLocaleString()}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={announcementStatusData}
                      dataKey="value"
                      nameKey="key"
                      innerRadius={48}
                      outerRadius={74}
                      strokeWidth={2}
                    >
                      {announcementStatusData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {announcementStatusData.map((item) => (
                    <DistributionStat
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      fill={item.fill}
                      percentage={
                        dashboardData.announcements.length > 0
                          ? Math.round((item.value / dashboardData.announcements.length) * 100)
                          : 0
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <ChartEmptyState message="No announcements yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Edit Club</CardTitle>
            <CardDescription>Update the basics that appear throughout the club dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Club Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Club name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Club description"
                rows={4}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSaveChanges} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button onClick={cancelEditing} variant="outline" disabled={saving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Club</DialogTitle>
            <DialogDescription>
              This action cannot be undone. To confirm deletion, type the club name below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Club name to confirm</Label>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                {project.name}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type the club name to confirm</Label>
              <Input
                id="delete-confirm"
                placeholder="Enter club name"
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
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
              onClick={handleDeleteProject}
              disabled={deleting || deleteConfirmInput !== project.name}
              variant="destructive"
            >
              {deleting ? 'Deleting...' : 'Delete Club'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewStatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-right">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DistributionStat({
  label,
  value,
  fill,
  percentage,
}: {
  label: string;
  value: number;
  fill: string;
  percentage: number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fill }} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{percentage}%</span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function buildOverviewSummary(params: {
  clubName: string;
  studentCount: number;
  collaboratorCount: number;
  announcementCount: number;
  eventCount: number;
}) {
  const { clubName, studentCount, collaboratorCount, announcementCount, eventCount } = params;

  if (studentCount === 0 && collaboratorCount === 0 && announcementCount === 0 && eventCount === 0) {
    return `${clubName} is ready to publish, schedule, and track attendance.`;
  }

  return `${studentCount} student${pluralize(studentCount)}, ${collaboratorCount} collaborator${pluralize(collaboratorCount)}, ${eventCount} event${pluralize(eventCount)}, ${announcementCount} live announcement${pluralize(announcementCount)}.`;
}

function buildActivityChartData(
  announcements: Announcement[],
  events: EventRecord[],
  sessions: AttendanceSessionRecord[],
): ActivityChartRow[] {
  const months = buildRecentMonthBuckets(6);
  const byMonth = new Map(
    months.map((row) => [
      row.key,
      { ...row, announcements: 0, events: 0, sessions: 0, total: 0 },
    ]),
  );

  announcements.forEach((announcement) => {
    const key = monthKeyFromValue(announcement.published_at || announcement.created_at);
    if (!key || !byMonth.has(key)) return;

    const current = byMonth.get(key)!;
    current.announcements += 1;
    current.total += 1;
  });

  events.forEach((event) => {
    const key = monthKeyFromValue(event.start_at || event.created_at);
    if (!key || !byMonth.has(key)) return;

    const current = byMonth.get(key)!;
    current.events += 1;
    current.total += 1;
  });

  sessions.forEach((session) => {
    const key = monthKeyFromValue(session.created_at || session.meeting_date);
    if (!key || !byMonth.has(key)) return;

    const current = byMonth.get(key)!;
    current.sessions += 1;
    current.total += 1;
  });

  return months.map((row) => byMonth.get(row.key)!);
}

function buildGrowthChartData(
  students: StudentProfile[],
  collaborators: ProjectMember[],
): GrowthChartRow[] {
  const months = buildRecentMonthBuckets(6);

  return months.map((month) => {
    const monthEnd = endOfMonthFromKey(month.key);
    const studentCount = students.filter((student) => {
      const time = parseDateValue(student.joined_at);
      return time != null && time <= monthEnd.getTime();
    }).length;

    const collaboratorCount = collaborators.filter((member) => {
      const time = parseDateValue(member.joined_at || member.created_at);
      return time != null && time <= monthEnd.getTime();
    }).length;

    return {
      ...month,
      students: studentCount,
      collaborators: collaboratorCount,
      totalPeople: studentCount + collaboratorCount,
    };
  });
}

function buildPublishingPipelineData(values: {
  publishedAnnouncements: number;
  draftAnnouncements: number;
  publicEvents: number;
  privateEvents: number;
  publicMeetings: number;
  pendingInvites: number;
}): PipelineRow[] {
  return [
    {
      key: 'published-announcements',
      label: 'Published',
      value: values.publishedAnnouncements,
      fill: 'var(--primary)',
    },
    {
      key: 'draft-announcements',
      label: 'Drafts',
      value: values.draftAnnouncements,
      fill: 'var(--chart-5)',
    },
    {
      key: 'public-events',
      label: 'Public events',
      value: values.publicEvents,
      fill: 'var(--chart-2)',
    },
    {
      key: 'private-events',
      label: 'Private events',
      value: values.privateEvents,
      fill: 'var(--chart-4)',
    },
    {
      key: 'public-meetings',
      label: 'Public meetings',
      value: values.publicMeetings,
      fill: '#0f766e',
    },
    {
      key: 'pending-invites',
      label: 'Pending invites',
      value: values.pendingInvites,
      fill: '#e11d48',
    },
  ];
}

function buildAnnouncementStatusData(values: {
  total: number;
  published: number;
  drafts: number;
}): AnnouncementStatusRow[] {
  const other = Math.max(values.total - values.published - values.drafts, 0);

  return [
    {
      key: 'published',
      label: 'Published',
      value: values.published,
      fill: 'var(--primary)',
    },
    {
      key: 'draft',
      label: 'Drafts',
      value: values.drafts,
      fill: 'var(--chart-5)',
    },
    {
      key: 'other',
      label: 'Other',
      value: other,
      fill: 'var(--chart-4)',
    },
  ];
}

function buildWeeklyUpcomingEventsData(events: EventRecord[], weeks: number): WeeklyEventsRow[] {
  const start = startOfWeek(new Date());
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const buckets = Array.from({ length: weeks }, (_, index) => {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + index * 7);

    return {
      key: weekKeyFromDate(weekStart),
      week: `W${index + 1}`,
      fullLabel: `Week of ${formatter.format(weekStart)}`,
      publicEvents: 0,
      privateEvents: 0,
      total: 0,
    };
  });

  const byWeek = new Map(buckets.map((bucket) => [bucket.key, { ...bucket }]));

  events.forEach((event) => {
    const time = parseDateValue(event.start_at);
    if (time == null) return;

    const key = weekKeyFromDate(new Date(time));
    const bucket = byWeek.get(key);
    if (!bucket) return;

    if (event.visibility === 'public') {
      bucket.publicEvents += 1;
    } else {
      bucket.privateEvents += 1;
    }

    bucket.total += 1;
  });

  return buckets.map((bucket) => byWeek.get(bucket.key) ?? bucket);
}

function buildRecentMonthBuckets(length: number) {
  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
  });
  const fullMonthFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return Array.from({ length }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (length - 1 - index));

    return {
      key: monthKeyFromDate(date),
      month: monthFormatter.format(date),
      fullLabel: fullMonthFormatter.format(date),
    };
  });
}

function endOfMonthFromKey(key: string) {
  const [yearText, monthText] = key.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekKeyFromDate(date: Date) {
  const weekStart = startOfWeek(date);
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(
    weekStart.getDate(),
  ).padStart(2, '0')}`;
}

function countRecentDates(values: Array<string | null | undefined>, days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return values.reduce((count, value) => {
    const time = parseDateValue(value ?? null);
    return time != null && time >= cutoff ? count + 1 : count;
  }, 0);
}

function isWithinDays(value: string | null, days: number) {
  const time = parseDateValue(value);
  if (time == null) return false;

  const now = Date.now();
  const futureLimit = now + days * 24 * 60 * 60 * 1000;
  return time >= now && time <= futureLimit;
}

function parseDateValue(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function monthKeyFromValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return monthKeyFromDate(date);
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatSessionTick(dateValue: string) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatShortDate(value: string | null) {
  if (!value) return 'Unknown';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  return parsed.toLocaleDateString(undefined, {
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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function projectStatusClass(status: string | null | undefined) {
  if (status === 'active') return 'border-transparent bg-green-50 text-green-700';
  if (status === 'off' || status === 'paused' || status === 'archived') {
    return 'border-transparent bg-red-50 text-red-700';
  }
  if (status === 'deploying' || status === 'coming_up' || status === 'restoring') {
    return 'border-slate-200 bg-white text-slate-900';
  }
  return 'border-border bg-background text-muted-foreground';
}

function formatDelta(value: number) {
  if (value === 0) return 'No change';
  return `${value > 0 ? '+' : ''}${value} pts`;
}

function getUserEmail(user: unknown) {
  if (!user || typeof user !== 'object') return 'Unknown account';
  const email = 'email' in user ? user.email : undefined;
  return typeof email === 'string' && email.length > 0 ? email : 'Unknown account';
}

function pluralize(value: number) {
  return value === 1 ? '' : 's';
}
