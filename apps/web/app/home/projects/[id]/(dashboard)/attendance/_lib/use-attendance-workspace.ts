'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import {
  attendanceEntryKey,
  coerceAttendanceStatus,
  defaultSessionTitle,
  memberKey,
  nameKey,
  normalizeName,
  sortSessionsByDateDesc,
  todayIso,
  type AttendanceEntry,
  type AttendanceRow,
  type AttendanceSession,
  type AttendanceStatus,
  type CustomAttendee,
  type MemberProfile,
} from './attendance-utils';
export type DraftAttendanceStatus = AttendanceStatus | 'unmarked';

type CreateSessionInput = {
  title: string;
  meeting_date: string;
  notes: string;
  is_public: boolean;
};

type UseAttendanceWorkspaceOptions = {
  autoCreateToday?: boolean;
};

export function useAttendanceWorkspace(
  projectId: string | undefined,
  options: UseAttendanceWorkspaceOptions = {},
) {
  const { autoCreateToday = false } = options;
  const supabase = useSupabase();

  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [entriesBySession, setEntriesBySession] = useState<Record<string, AttendanceEntry[]>>({});

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [customAttendees, setCustomAttendees] = useState<CustomAttendee[]>([]);
  const [statusByAttendeeKey, setStatusByAttendeeKey] = useState<Record<string, DraftAttendanceStatus>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );
  const isDraftSession = !selectedSession;

  const selectedEntries = useMemo(
    () => (selectedSessionId ? entriesBySession[selectedSessionId] ?? [] : []),
    [entriesBySession, selectedSessionId],
  );

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    const rosterRows = members.map((member) => ({
      key: memberKey(member.id),
      member_id: member.id,
      member_name: member.full_name,
      role: member.role,
      is_roster: true,
      status: (statusByAttendeeKey[memberKey(member.id)] ?? 'unmarked') as AttendanceStatus,
    }));

    const customRows = customAttendees.map((attendee) => ({
      key: attendee.key,
      member_id: null,
      member_name: attendee.member_name,
      role: null,
      is_roster: false,
      status: (statusByAttendeeKey[attendee.key] ?? 'unmarked') as AttendanceStatus,
    }));

    return [...rosterRows, ...customRows].sort((a, b) =>
      a.member_name.localeCompare(b.member_name),
    );
  }, [customAttendees, members, statusByAttendeeKey]);

  const selectedEntriesByKey = useMemo(() => {
    const grouped = new Map<string, AttendanceEntry[]>();

    selectedEntries.forEach((entry) => {
      const key = attendanceEntryKey(entry.member_id, entry.member_name);
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

    return grouped;
  }, [selectedEntries]);

  const changedRowKeys = useMemo(() => {
    const changed = new Set<string>();
    const rowByKey = new Map(attendanceRows.map((row) => [row.key, row] as const));

    attendanceRows.forEach((row) => {
      const existingEntries = selectedEntriesByKey.get(row.key) ?? [];
      const currentStatus = statusByAttendeeKey[row.key] ?? 'unmarked';

      if (existingEntries.length === 0) {
        if (!row.is_roster || currentStatus !== 'unmarked') {
          changed.add(row.key);
        }

        return;
      }

      if (
        currentStatus !== 'unmarked' &&
        (existingEntries.length > 1 || existingEntries[0]?.status !== currentStatus)
      ) {
        changed.add(row.key);
      }
    });

    selectedEntriesByKey.forEach((_, key) => {
      if (!rowByKey.has(key)) changed.add(key);
    });

    return changed;
  }, [attendanceRows, selectedEntriesByKey, statusByAttendeeKey]);

  const hasUnsavedChanges = changedRowKeys.size > 0;

  const sessionEntryCounts = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.id] = entriesBySession[session.id]?.length ?? 0;
      return acc;
    }, {});
  }, [entriesBySession, sessions]);

  const allKnownNames = useMemo(() => {
    const names = new Set<string>();

    members.forEach((member) => names.add(member.full_name));
    Object.values(entriesBySession).forEach((sessionEntries) => {
      sessionEntries.forEach((entry) => names.add(entry.member_name));
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [entriesBySession, members]);

  const loadAttendance = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);

    try {
      const { data: memberData, error: memberError } = await (supabase as any)
        .from('member_profiles')
        .select('id, full_name, role')
        .eq('project_id', projectId)
        .order('full_name', { ascending: true });

      if (memberError) throw memberError;

      const { data: sessionData, error: sessionError } = await (supabase as any)
        .from('attendance_sessions')
        .select('id, project_id, title, meeting_date, notes, is_public, created_at')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false });

      if (sessionError) throw sessionError;

      const normalizedSessions = ((sessionData ?? []) as AttendanceSession[]).sort(
        sortSessionsByDateDesc,
      );

      let nextSessions = normalizedSessions;
      let nextEntriesBySession: Record<string, AttendanceEntry[]> = {};

      const sessionIds = normalizedSessions.map((session) => session.id);
      if (sessionIds.length > 0) {
        const { data: entryData, error: entryError } = await (supabase as any)
          .from('attendance_entries')
          .select('id, session_id, member_id, member_name, status, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false });

        if (entryError) throw entryError;

        ((entryData ?? []) as Array<Omit<AttendanceEntry, 'status'> & { status: unknown }>).forEach(
          (entry) => {
            const normalizedEntry: AttendanceEntry = {
              ...entry,
              status: coerceAttendanceStatus(entry.status),
            };

            const bucket = nextEntriesBySession[normalizedEntry.session_id] ?? [];
            bucket.push(normalizedEntry);
            nextEntriesBySession[normalizedEntry.session_id] = bucket;
          },
        );
      }

      if (autoCreateToday) {
        const todayDate = todayIso();
        const sessionForToday = normalizedSessions.find(
          (session) => session.meeting_date === todayDate,
        );

        if (!sessionForToday) {
          const autoSessionPayload = {
            project_id: projectId,
            title: defaultSessionTitle(todayDate),
            meeting_date: todayDate,
            notes: null,
            is_public: false,
          };

          const { data: autoSessionData, error: autoSessionError } = await (supabase as any)
            .from('attendance_sessions')
            .insert(autoSessionPayload)
            .select('id, project_id, title, meeting_date, notes, is_public, created_at')
            .single();

          if (autoSessionError) {
            console.error('Failed to auto-create today meeting', autoSessionError);
            toast.error('Could not auto-create today meeting');
          } else if (autoSessionData) {
            const autoSession = autoSessionData as AttendanceSession;
            nextSessions = [...normalizedSessions, autoSession].sort(sortSessionsByDateDesc);
            nextEntriesBySession = {
              ...nextEntriesBySession,
              [autoSession.id]: [],
            };
          }
        }
      }

      const nextSessionIds = nextSessions.map((session) => session.id);
      const preferredSessionId = nextSessionIds[0] ?? null;

      setMembers((memberData ?? []) as MemberProfile[]);
      setSessions(nextSessions);
      setEntriesBySession(nextEntriesBySession);
      setSelectedSessionId((current) => {
        if (current && nextSessionIds.includes(current)) return current;
        return preferredSessionId;
      });
      setSelectedDate((current) => current || nextSessions[0]?.meeting_date || todayIso());
    } catch (error) {
      console.error('Failed to load attendance data', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [autoCreateToday, projectId, supabase]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const match = sessions.find((session) => session.meeting_date === selectedDate);
    setSelectedSessionId(match?.id ?? null);
  }, [selectedDate, sessions]);

  const resetDraftFromSelectedEntries = useCallback(() => {
    const nextStatuses: Record<string, DraftAttendanceStatus> = {};
    const nextCustom = new Map<string, CustomAttendee>();
    const memberIdByName = new Map(
      members.map((member) => [normalizeName(member.full_name), member.id] as const),
    );

    members.forEach((member) => {
      nextStatuses[memberKey(member.id)] = selectedSession ? 'absent' : 'unmarked';
    });

    selectedEntries.forEach((entry) => {
      const resolvedMemberId =
        entry.member_id ?? memberIdByName.get(normalizeName(entry.member_name));

      if (resolvedMemberId) {
        nextStatuses[memberKey(resolvedMemberId)] = entry.status;
        return;
      }

      const key = nameKey(entry.member_name);
      nextCustom.set(key, { key, member_name: entry.member_name });
      nextStatuses[key] = entry.status;
    });

    setCustomAttendees(
      Array.from(nextCustom.values()).sort((a, b) => a.member_name.localeCompare(b.member_name)),
    );
    setStatusByAttendeeKey(nextStatuses);
  }, [members, selectedEntries]);

  useEffect(() => {
    resetDraftFromSelectedEntries();
  }, [resetDraftFromSelectedEntries]);

  const setAttendanceStatus = useCallback((key: string, status: DraftAttendanceStatus) => {
    setStatusByAttendeeKey((prev) => ({ ...prev, [key]: status }));
  }, []);

  const discardChanges = useCallback(() => {
    resetDraftFromSelectedEntries();
    toast.info('Unsaved changes discarded');
  }, [resetDraftFromSelectedEntries]);

  const addManualAttendee = useCallback(
    (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) return false;

      if (trimmedName.length > 80) {
        toast.error('Attendee name must be 80 characters or less');
        return false;
      }

      const key = nameKey(trimmedName);
      const exists = attendanceRows.some((row) => row.key === key);
      if (exists) {
        toast.error('Attendee already exists in this meeting');
        return false;
      }

      setCustomAttendees((prev) =>
        [...prev, { key, member_name: trimmedName }].sort((a, b) =>
          a.member_name.localeCompare(b.member_name),
        ),
      );
      setStatusByAttendeeKey((prev) => ({ ...prev, [key]: 'unmarked' }));
      return true;
    },
    [attendanceRows],
  );

  const removeManualAttendee = useCallback((key: string) => {
    setCustomAttendees((prev) => prev.filter((attendee) => attendee.key !== key));
    setStatusByAttendeeKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const createSession = useCallback(
    async (input: CreateSessionInput) => {
      if (!projectId) {
        toast.error('Missing project id');
        return null;
      }

      const meetingDate = input.meeting_date || todayIso();
      const title = input.title.trim() || defaultSessionTitle(meetingDate);

      if (title.length > 120) {
        toast.error('Meeting title must be 120 characters or less');
        return null;
      }

      if (input.notes.length > 2000) {
        toast.error('Meeting notes must be 2000 characters or less');
        return null;
      }

      setCreatingSession(true);

      try {
        const payload = {
          project_id: projectId,
          title,
          meeting_date: meetingDate,
          notes: input.notes.trim() || null,
          is_public: input.is_public,
        };

        const { data, error } = await (supabase as any)
          .from('attendance_sessions')
          .insert(payload)
          .select('id, project_id, title, meeting_date, notes, is_public, created_at')
          .single();

        if (error) throw error;

        const newSession = data as AttendanceSession;

        setSessions((prev) => [...prev, newSession].sort(sortSessionsByDateDesc));
        setEntriesBySession((prev) => ({ ...prev, [newSession.id]: [] }));
        setSelectedSessionId(newSession.id);
        toast.success('Meeting created');

        return newSession;
      } catch (error) {
        console.error('Failed to create meeting', error);
        toast.error('Failed to create meeting');
        return null;
      } finally {
        setCreatingSession(false);
      }
    },
    [projectId, supabase],
  );

  const deleteSession = useCallback(
    async (session: AttendanceSession) => {
      setDeletingSessionId(session.id);

      try {
        const { error } = await (supabase as any)
          .from('attendance_sessions')
          .delete()
          .eq('id', session.id);

        if (error) throw error;

        setSessions((prev) => {
          const next = prev.filter((item) => item.id !== session.id);
          if (selectedSessionId === session.id) {
            setSelectedSessionId(next[0]?.id ?? null);
          }
          return next;
        });

        setEntriesBySession((prev) => {
          const next = { ...prev };
          delete next[session.id];
          return next;
        });

        toast.success('Meeting deleted');
        return true;
      } catch (error) {
        console.error('Failed to delete meeting', error);
        toast.error('Failed to delete meeting');
        return false;
      } finally {
        setDeletingSessionId(null);
      }
    },
    [selectedSessionId, supabase],
  );

  const renameSession = useCallback(
    async (sessionId: string, nextTitle: string) => {
      const trimmedTitle = nextTitle.trim();
      const session = sessions.find((candidate) => candidate.id === sessionId);

      if (!session) {
        toast.error('Meeting not found');
        return false;
      }

      if (!trimmedTitle) {
        toast.error('Meeting title is required');
        return false;
      }

      if (trimmedTitle.length > 120) {
        toast.error('Meeting title must be 120 characters or less');
        return false;
      }

      if (trimmedTitle === session.title) {
        return true;
      }

      setRenamingSessionId(sessionId);

      try {
        const { data, error } = await (supabase as any)
          .from('attendance_sessions')
          .update({ title: trimmedTitle })
          .eq('id', sessionId)
          .select('id, project_id, title, meeting_date, notes, is_public, created_at')
          .single();

        if (error) throw error;

        const updatedSession = data as AttendanceSession;

        setSessions((prev) =>
          prev
            .map((item) => (item.id === sessionId ? updatedSession : item))
            .sort(sortSessionsByDateDesc),
        );

        toast.success('Meeting renamed');
        return true;
      } catch (error) {
        console.error('Failed to rename meeting', error);
        toast.error('Failed to rename meeting');
        return false;
      } finally {
        setRenamingSessionId(null);
      }
    },
    [sessions, supabase],
  );

  const saveAttendance = useCallback(
    async (options?: { newSessionTitle?: string }) => {

    if (attendanceRows.length === 0) {
      toast.error('No attendees to save');
      return false;
    }

    if (!hasUnsavedChanges) {
      toast.info('No unsaved changes');
      return false;
    }

    setSavingAttendance(true);

    try {
      const rowByKey = new Map(attendanceRows.map((row) => [row.key, row] as const));
      let workingSession = selectedSession;
      if (!workingSession) {
        const draftTitle = options?.newSessionTitle?.trim();
        const titleForCreate = draftTitle || defaultSessionTitle(selectedDate);
        const { data: created, error: createError } = await (supabase as any)
          .from('attendance_sessions')
          .insert({
            project_id: projectId,
            title: titleForCreate,
            meeting_date: selectedDate,
            notes: null,
            is_public: false,
          })
          .select('id, project_id, title, meeting_date, notes, is_public, created_at')
          .single();
        if (createError) throw createError;
        workingSession = created as AttendanceSession;
        setSessions((prev) => [...prev, workingSession!].sort(sortSessionsByDateDesc));
        setSelectedSessionId(workingSession.id);
      }
      const entriesToDelete = new Set<string>();
      const payload: Array<{
        session_id: string;
        member_id: string | null;
        member_name: string;
        status: AttendanceStatus;
      }> = [];

      attendanceRows.forEach((row) => {
        const currentStatus = statusByAttendeeKey[row.key] ?? 'unmarked';
        const existingEntries = selectedEntriesByKey.get(row.key) ?? [];
        const primaryExisting = existingEntries[0] ?? null;

        if (primaryExisting) {
          if (
            currentStatus !== 'unmarked' &&
            (primaryExisting.status !== currentStatus || existingEntries.length > 1)
          ) {
            existingEntries.forEach((entry) => entriesToDelete.add(entry.id));
            payload.push({
              session_id: workingSession.id,
              member_id: row.member_id,
              member_name: row.member_name,
              status: currentStatus,
            });
          }

          return;
        }

        const shouldInsert =
          currentStatus !== 'unmarked' &&
          (selectedEntries.length === 0 || !row.is_roster || currentStatus !== 'absent');

        if (shouldInsert) {
          payload.push({
            session_id: workingSession.id,
            member_id: row.member_id,
            member_name: row.member_name,
            status: currentStatus as AttendanceStatus,
          });
        }
      });

      selectedEntriesByKey.forEach((entries, key) => {
        if (rowByKey.has(key)) return;
        entries.forEach((entry) => entriesToDelete.add(entry.id));
      });

      const deleteIds = Array.from(entriesToDelete);
      if (deleteIds.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('attendance_entries')
          .delete()
          .eq('session_id', workingSession.id)
          .in('id', deleteIds);

        if (deleteError) throw deleteError;
      }

      if (payload.length > 0) {
        const { error: insertError } = await (supabase as any)
          .from('attendance_entries')
          .insert(payload);

        if (insertError) {
          const isStatusConstraintError =
            insertError?.code === '23514' &&
            String(insertError?.message ?? '').includes(
              'attendance_entries_status_check',
            );
          const hasLateStatus = payload.some((row) => row.status === 'late');

          if (isStatusConstraintError && hasLateStatus) {
            const normalizedPayload = payload.map((row) => ({
              ...row,
              status: row.status === 'late' ? 'present' : row.status,
            }));

            const { error: retryError } = await (supabase as any)
              .from('attendance_entries')
              .insert(normalizedPayload);

            if (retryError) throw retryError;

            toast.warning(
              'Your database does not support "Late" yet. Late entries were saved as Present.',
            );
          } else {
            throw insertError;
          }
        }
      }

      const { data, error: refreshError } = await (supabase as any)
        .from('attendance_entries')
        .select('id, session_id, member_id, member_name, status, created_at')
        .eq('session_id', workingSession.id)
        .order('created_at', { ascending: false });

      if (refreshError) throw refreshError;

      setEntriesBySession((prev) => ({
        ...prev,
        [workingSession.id]: ((data ?? []) as Array<
          Omit<AttendanceEntry, 'status'> & { status: unknown }
        >).map((entry) => ({
          ...entry,
          status: coerceAttendanceStatus(entry.status),
        })),
      }));

      toast.success('Attendance changes saved');
      return true;
    } catch (error) {
      console.error('Failed to save attendance', error);
      toast.error('Failed to save attendance');
      return false;
    } finally {
      setSavingAttendance(false);
    }
    },
    [
      attendanceRows,
      hasUnsavedChanges,
      selectedEntries.length,
      selectedEntriesByKey,
      selectedSession,
      selectedDate,
      projectId,
      statusByAttendeeKey,
      supabase,
    ],
  );

  return {
    members,
    sessions,
    entriesBySession,
    selectedSessionId,
    setSelectedSessionId,
    selectedDate,
    setSelectedDate,
    isDraftSession,
    selectedSession,
    attendanceRows,
    loading,
    creatingSession,
    savingAttendance,
    renamingSessionId,
    deletingSessionId,
    changedRowKeys,
    hasUnsavedChanges,
    sessionEntryCounts,
    allKnownNames,
    refresh: loadAttendance,
    setAttendanceStatus,
    discardChanges,
    addManualAttendee,
    removeManualAttendee,
    createSession,
    renameSession,
    deleteSession,
    saveAttendance,
  };
}
