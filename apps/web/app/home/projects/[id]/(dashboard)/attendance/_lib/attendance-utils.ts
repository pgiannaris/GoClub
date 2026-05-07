'use client';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'excused'
  | 'absent'
  | 'unmarked';
export type StatusFilter = 'all' | AttendanceStatus;
export type AttendanceTypeFilter = 'all' | 'roster' | 'manual';
export type ExcusedWeight = 0 | 0.5;

export type MemberProfile = {
  id: string;
  full_name: string;
  role: string | null;
};

export type AttendanceSession = {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  event_id: string | null;
  notes: string | null;
  is_public: boolean;
  created_at: string | null;
};

export type AttendanceEntry = {
  id: string;
  session_id: string;
  member_id: string | null;
  member_name: string;
  status: AttendanceStatus;
  created_at: string | null;
};

export type CustomAttendee = {
  key: string;
  member_name: string;
};

export type AttendanceRow = {
  key: string;
  member_id: string | null;
  member_name: string;
  role: string | null;
  is_roster: boolean;
  status: AttendanceStatus;
};

export type AttendanceHistoryRow = {
  key: string;
  session_id: string;
  session_title: string;
  meeting_date: string;
  member_id: string | null;
  member_name: string;
  is_roster: boolean;
  status: AttendanceStatus;
};

export type OverallAttendanceRow = {
  key: string;
  member_id: string | null;
  member_name: string;
  is_roster: boolean;
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  weighted_attendance: number;
  percent: number;
  total_sessions: number;
};

export const ATTENDANCE_STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  shortLabel: string;
  shortcut: string;
}> = [
  { value: 'present', label: 'Present', shortLabel: 'P', shortcut: 'P' },
  { value: 'late', label: 'Late', shortLabel: 'L', shortcut: 'L' },
  { value: 'excused', label: 'Excused', shortLabel: 'E', shortcut: 'E' },
  { value: 'absent', label: 'Absent', shortLabel: 'A', shortcut: 'A' },
];

export function coerceAttendanceStatus(value: unknown): AttendanceStatus {
  if (
    value === 'present' ||
    value === 'late' ||
    value === 'excused' ||
    value === 'absent' ||
    value === 'unmarked'
  ) {
    return value;
  }

  return 'absent';
}

export function statusLabel(status: AttendanceStatus) {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  if (status === 'excused') return 'Excused';
  if (status === 'unmarked') return 'Unmarked';
  return 'Absent';
}

export function statusBadgeClass(status: AttendanceStatus) {
  if (status === 'present')
    return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'late')
    return 'border-orange-200 bg-orange-50 text-orange-700';
  if (status === 'excused')
    return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  if (status === 'unmarked')
    return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-red-200 bg-red-50 text-red-700';
}

export function statusButtonClass(status: AttendanceStatus, active: boolean) {
  if (active) {
    if (status === 'present') return 'border-green-600 bg-green-600 text-white';
    if (status === 'late') return 'border-orange-500 bg-orange-500 text-white';
    if (status === 'excused')
      return 'border-yellow-500 bg-yellow-500 text-white';
    return 'border-red-600 bg-red-600 text-white';
  }

  if (status === 'present')
    return 'border-green-200 text-green-700 hover:bg-green-50';
  if (status === 'late')
    return 'border-orange-200 text-orange-700 hover:bg-orange-50';
  if (status === 'excused')
    return 'border-yellow-200 text-yellow-700 hover:bg-yellow-50';
  return 'border-red-200 text-red-700 hover:bg-red-50';
}

export function getAttendanceWeight(
  status: AttendanceStatus,
  excusedWeight: ExcusedWeight = 0.5,
) {
  if (status === 'present' || status === 'late') return 1;
  if (status === 'excused') return excusedWeight;
  if (status === 'unmarked') return 0;
  return 0;
}

export function calculateSessionStats(
  rows: AttendanceRow[],
  excusedWeight: ExcusedWeight = 0.5,
) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] += 1;
      if (row.status === 'unmarked') {
        acc.absent += 0;
      }
      acc.weighted += getAttendanceWeight(row.status, excusedWeight);
      return acc;
    },
    {
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      unmarked: 0,
      weighted: 0,
    },
  );

  return {
    ...totals,
    rate:
      totals.total > 0 ? Math.round((totals.weighted / totals.total) * 100) : 0,
  };
}

export function buildAttendanceHistory(
  sessions: AttendanceSession[],
  entriesBySession: Record<string, AttendanceEntry[]>,
  members: MemberProfile[],
) {
  const memberIdSet = new Set(members.map((member) => member.id));
  const rows: AttendanceHistoryRow[] = [];

  sessions.forEach((session) => {
    const sessionEntries = entriesBySession[session.id] ?? [];

    sessionEntries.forEach((entry) => {
      rows.push({
        key: `${session.id}:${entry.id}`,
        session_id: session.id,
        session_title: session.title,
        meeting_date: session.meeting_date,
        member_id: entry.member_id,
        member_name: entry.member_name,
        is_roster: entry.member_id ? memberIdSet.has(entry.member_id) : false,
        status: coerceAttendanceStatus(entry.status),
      });
    });
  });

  return rows.sort((a, b) => {
    const dateComparison = sortDateStringsDesc(a.meeting_date, b.meeting_date);
    if (dateComparison !== 0) return dateComparison;
    return a.member_name.localeCompare(b.member_name);
  });
}

export function buildOverallAttendanceRows(params: {
  members: MemberProfile[];
  sessions: AttendanceSession[];
  entriesBySession: Record<string, AttendanceEntry[]>;
  excusedWeight: ExcusedWeight;
}) {
  const { members, sessions, entriesBySession, excusedWeight } = params;

  const allPeople = new Map<
    string,
    {
      key: string;
      member_id: string | null;
      member_name: string;
      is_roster: boolean;
    }
  >();

  members.forEach((member) => {
    allPeople.set(memberKey(member.id), {
      key: memberKey(member.id),
      member_id: member.id,
      member_name: member.full_name,
      is_roster: true,
    });
  });

  const memberIdByName = new Map(
    members.map(
      (member) => [normalizeName(member.full_name), member.id] as const,
    ),
  );

  Object.values(entriesBySession).forEach((sessionEntries) => {
    sessionEntries.forEach((entry) => {
      const resolvedMemberId =
        entry.member_id ?? memberIdByName.get(normalizeName(entry.member_name));

      if (resolvedMemberId) return;

      const key = nameKey(entry.member_name);
      if (!allPeople.has(key)) {
        allPeople.set(key, {
          key,
          member_id: null,
          member_name: entry.member_name,
          is_roster: false,
        });
      }
    });
  });

  return Array.from(allPeople.values())
    .map((person) => {
      let weightedAttendance = 0;
      let presentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      let absentCount = 0;

      sessions.forEach((session) => {
        const sessionEntries = entriesBySession[session.id] ?? [];
        const found = findEntryForPerson(
          sessionEntries,
          person.member_id,
          person.member_name,
        );
        const status = found?.status ?? 'absent';

        if (status === 'present') presentCount += 1;
        if (status === 'late') lateCount += 1;
        if (status === 'excused') excusedCount += 1;
        if (status === 'absent') absentCount += 1;

        weightedAttendance += getAttendanceWeight(status, excusedWeight);
      });

      const percent =
        sessions.length > 0
          ? Math.round((weightedAttendance / sessions.length) * 100)
          : 0;

      return {
        ...person,
        present_count: presentCount,
        late_count: lateCount,
        excused_count: excusedCount,
        absent_count: absentCount,
        weighted_attendance: weightedAttendance,
        percent,
        total_sessions: sessions.length,
      } satisfies OverallAttendanceRow;
    })
    .sort(
      (a, b) =>
        b.percent - a.percent || a.member_name.localeCompare(b.member_name),
    );
}

export function memberKey(id: string) {
  return `member:${id}`;
}

export function attendanceEntryKey(
  memberId: string | null,
  memberName: string,
) {
  return memberId ? memberKey(memberId) : nameKey(memberName);
}

export function nameKey(name: string) {
  return `name:${normalizeName(name)}`;
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function defaultSessionTitle(dateValue: string) {
  return `Meeting ${dateValue}`;
}

export function parseIsoDate(dateValue: string) {
  const parts = dateValue.split('-');
  const year = Number.parseInt(parts[0] ?? '', 10);
  const month = Number.parseInt(parts[1] ?? '', 10);
  const day = Number.parseInt(parts[2] ?? '', 10);

  return new Date(
    Number.isNaN(year) ? 1970 : year,
    Number.isNaN(month) ? 0 : month - 1,
    Number.isNaN(day) ? 1 : day,
  );
}

export function formatReadableDate(dateValue: string) {
  return parseIsoDate(dateValue).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function sortSessionsByDateDesc(
  a: AttendanceSession,
  b: AttendanceSession,
) {
  return sortDateStringsDesc(a.meeting_date, b.meeting_date);
}

export function sortDateStringsDesc(a: string, b: string) {
  return parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatWeighted(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function findEntryForPerson(
  sessionEntries: AttendanceEntry[],
  memberId: string | null,
  memberName: string,
) {
  if (memberId) {
    const byId = sessionEntries.find((entry) => entry.member_id === memberId);
    if (byId) return byId;
  }

  const normalized = normalizeName(memberName);
  return sessionEntries.find(
    (entry) => normalizeName(entry.member_name) === normalized,
  );
}
