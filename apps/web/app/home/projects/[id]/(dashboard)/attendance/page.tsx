'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
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
  type StatusFilter,
  capitalize,
  defaultSessionTitle,
  formatReadableDate,
} from './_lib/attendance-utils';
import { useAttendanceWorkspace } from './_lib/use-attendance-workspace';

type EventLinkCandidate = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

type LinkContext = 'draft' | 'session';

type AttendanceQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type AttendanceQueryBuilder = {
  select(columns: string): AttendanceQueryBuilder;
  eq(column: string, value: string): AttendanceQueryBuilder;
  gte(column: string, value: string): AttendanceQueryBuilder;
  lte(column: string, value: string): AttendanceQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): AttendanceQueryBuilder;
  in(column: string, values: string[]): AttendanceQueryBuilder;
  insert(values: unknown): AttendanceQueryBuilder;
  update(values: unknown): AttendanceQueryBuilder;
  delete(): AttendanceQueryBuilder;
  maybeSingle(): Promise<AttendanceQueryResult>;
  single(): Promise<AttendanceQueryResult>;
  then<TResult1 = AttendanceQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: AttendanceQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

type AttendanceSupabaseClient = {
  from(relation: string): AttendanceQueryBuilder;
};

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
    deletingSessionId,
    deleteSession,
    linkSessionToEvent,
    removeManualAttendee,
    renameSession,
    renamingSessionId,
    saveAttendance,
    savingAttendance,
    selectedSession,
    selectedSessionId,
    selectedDate,
    sessions,
    setSelectedDate,
    setAttendanceStatus,
    setSelectedSessionId,
    isDraftSession,
  } = useAttendanceWorkspace(projectId);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [manualAttendeeName, setManualAttendeeName] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingCreateNewMeeting, setPendingCreateNewMeeting] = useState(false);
  const [startedAttendanceFlow, setStartedAttendanceFlow] = useState(false);

  // Link-to-event modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkContext, setLinkContext] = useState<LinkContext>('draft');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventCandidates, setEventCandidates] = useState<EventLinkCandidate[]>(
    [],
  );
  const [selectedEventIdForLink, setSelectedEventIdForLink] = useState<
    string | null
  >(null);
  const [draftLinkedEventId, setDraftLinkedEventId] = useState<string | null>(
    null,
  );
  const [linkedEvent, setLinkedEvent] = useState<EventLinkCandidate | null>(
    null,
  );
  const supabase = useSupabase();
  const attendanceDb = supabase as unknown as AttendanceSupabaseClient;

  // ── New Meeting Modal state ──
  const [newMeetingModalOpen, setNewMeetingModalOpen] = useState(false);
  const [newMeetingModalDate, setNewMeetingModalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [newMeetingModalNameChoice, setNewMeetingModalNameChoice] = useState<
    'auto' | 'custom'
  >('auto');
  const [newMeetingModalCustomName, setNewMeetingModalCustomName] =
    useState('');

  // ── Edit Previous Meeting Modal state ──
  const [editPreviousModalOpen, setEditPreviousModalOpen] = useState(false);
  const [editPreviousSelectedId, setEditPreviousSelectedId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');

  // Rename state for existing sessions
  const [editingMeetingName, setEditingMeetingName] = useState(false);
  const [meetingNameDraft, setMeetingNameDraft] = useState('');

  // Save-flow modals
  const [meetingNameModalOpen, setMeetingNameModalOpen] = useState(false);
  const [nameMeetingChoice, setNameMeetingChoice] = useState<'no' | 'yes'>(
    'no',
  );
  const [newMeetingName, setNewMeetingName] = useState('');

  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const meetingNameInputRef = useRef<HTMLInputElement | null>(null);
  const initializedDefaultMeetingRef = useRef(false);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return attendanceRows.filter((row) => {
      const matchesName = row.member_name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'all' ? true : row.status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [attendanceRows, searchQuery, statusFilter]);

  const canClearFilters =
    searchQuery.trim().length > 0 || statusFilter !== 'all';

  useEffect(() => {
    if (isDraftSession) {
      const today = new Date().toISOString().slice(0, 10);
      setDraftDate(today);
      setSelectedDate(today);
    }
  }, [isDraftSession, setSelectedDate]);

  useEffect(() => {
    if (isDraftSession && draftDate) {
      setSelectedDate(draftDate);
    }
  }, [draftDate, isDraftSession, setSelectedDate]);

  useEffect(() => {
    if (initializedDefaultMeetingRef.current) return;
    if (requestedSessionId) return;
    if (loading) return;
    initializedDefaultMeetingRef.current = true;
    setSelectedSessionId(null);
  }, [loading, requestedSessionId, setSelectedSessionId]);

  useEffect(() => {
    if (!requestedSessionId || hasUnsavedChanges) return;
    if (!sessions.some((session) => session.id === requestedSessionId)) return;
    if (requestedSessionId === selectedSessionId) return;
    setSelectedSessionId(requestedSessionId);
  }, [
    hasUnsavedChanges,
    requestedSessionId,
    selectedSessionId,
    sessions,
    setSelectedSessionId,
  ]);

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
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, currentUrl.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(anchor.href);
      setConfirmLeaveOpen(true);
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
    if (shouldOpenTools) setToolsOpen(true);
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

  const activeLinkedEventId = selectedSession?.event_id ?? draftLinkedEventId;

  useEffect(() => {
    if (!activeLinkedEventId) {
      setLinkedEvent(null);
      return;
    }

    let cancelled = false;

    const loadLinkedEvent = async () => {
      const { data, error } = await attendanceDb
        .from('events')
        .select('id, title, start_at, end_at, location')
        .eq('id', activeLinkedEventId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Failed to load linked event', error);
        setLinkedEvent(null);
        return;
      }

      setLinkedEvent((data ?? null) as EventLinkCandidate | null);
    };

    void loadLinkedEvent();

    return () => {
      cancelled = true;
    };
  }, [activeLinkedEventId, attendanceDb]);

  const openLinkModal = (context: LinkContext) => {
    const currentEventId =
      selectedSession?.event_id ?? draftLinkedEventId ?? null;
    setLinkContext(context);
    setSelectedEventIdForLink(currentEventId);
    setEventSearchQuery('');
    setLinkModalOpen(true);
  };

  const handleAddManualAttendee = () => {
    const trimmed = manualAttendeeName.trim();
    const added = addManualAttendee(trimmed);
    if (!added) return;
    setManualAttendeeName('');
    setToolsOpen(true);
    requestAnimationFrame(() => manualInputRef.current?.focus());
  };

  const fetchEventCandidates = useCallback(async () => {
    if (!projectId) return;
    try {
      const day = new Date(
        selectedDate || new Date().toISOString().slice(0, 10),
      );
      const start = new Date(day);
      start.setDate(start.getDate() - 7);
      const end = new Date(day);
      end.setDate(end.getDate() + 7);

      const { data, error } = await attendanceDb
        .from('events')
        .select('id, title, start_at, end_at, location')
        .eq('project_id', projectId)
        .gte('start_at', start.toISOString())
        .lte('start_at', end.toISOString())
        .order('start_at', { ascending: true });

      if (error) throw error;
      setEventCandidates((data ?? []) as EventLinkCandidate[]);
    } catch (err) {
      console.error('Failed to load event candidates', err);
      setEventCandidates([]);
    }
  }, [attendanceDb, projectId, selectedDate]);

  useEffect(() => {
    if (!linkModalOpen) return;
    void fetchEventCandidates();
  }, [fetchEventCandidates, linkModalOpen]);

  const handleNewMeeting = () => {
    if (hasUnsavedChanges) {
      setPendingCreateNewMeeting(true);
      setConfirmLeaveOpen(true);
      return;
    }
    setNewMeetingModalDate(new Date().toISOString().slice(0, 10));
    setNewMeetingModalNameChoice('auto');
    setNewMeetingModalCustomName('');
    setDraftLinkedEventId(null);
    setStartedAttendanceFlow(true);
    setNewMeetingModalOpen(true);
  };

  const handleConfirmNewMeeting = () => {
    const resolvedDate =
      newMeetingModalDate || new Date().toISOString().slice(0, 10);
    const resolvedTitle =
      newMeetingModalNameChoice === 'custom' &&
      newMeetingModalCustomName.trim().length > 0
        ? newMeetingModalCustomName.trim()
        : defaultSessionTitle(resolvedDate);

    setNewMeetingModalOpen(false);
    setSelectedSessionId(null);
    setSelectedDate(resolvedDate);
    setDraftDate(resolvedDate);
    setDraftTitle(resolvedTitle);
    setDraftLinkedEventId(null);
    openLinkModal('draft');
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

  const handleDeleteMeeting = async () => {
    if (!selectedSession) return;
    const deleted = await deleteSession(selectedSession);
    if (!deleted) return;
    setDeleteModalOpen(false);
  };

  const handleSaveClick = async () => {
    if (!hasUnsavedChanges || savingAttendance) return;

    if (!isDraftSession) {
      void saveAttendance();
      return;
    }

    const resolvedDate = draftDate || new Date().toISOString().slice(0, 10);
    const fallbackTitle = defaultSessionTitle(resolvedDate);
    const candidateTitle =
      draftTitle.trim().length > 0 ? draftTitle.trim() : fallbackTitle;

    const duplicateExists = sessions.some(
      (session) =>
        session.meeting_date === resolvedDate &&
        session.title === candidateTitle,
    );

    if (duplicateExists) {
      setNameMeetingChoice('yes');
      setNewMeetingName(
        nextDuplicateMeetingTitle(sessions, resolvedDate, candidateTitle),
      );
      setMeetingNameModalOpen(true);
      return;
    }

    const saved = await saveAttendance({
      newSessionTitle: candidateTitle,
      newSessionEventId: draftLinkedEventId,
    });

    if (saved) {
      setDraftLinkedEventId(null);
    }
  };

  const confirmMeetingNameAndSave = async () => {
    const resolvedDate = draftDate || new Date().toISOString().slice(0, 10);
    const fallbackTitle = defaultSessionTitle(resolvedDate);
    const candidateTitle =
      nameMeetingChoice === 'yes' && newMeetingName.trim().length > 0
        ? newMeetingName.trim()
        : fallbackTitle;

    const duplicateExists = sessions.some(
      (session) =>
        session.meeting_date === resolvedDate &&
        session.title === candidateTitle,
    );

    if (duplicateExists) {
      setNameMeetingChoice('yes');
      setNewMeetingName(
        nextDuplicateMeetingTitle(sessions, resolvedDate, candidateTitle),
      );
      return;
    }

    const saved = await saveAttendance({
      newSessionTitle: candidateTitle,
      newSessionEventId: draftLinkedEventId,
    });

    if (saved) {
      setMeetingNameModalOpen(false);
      setDraftLinkedEventId(null);
    }
  };

  const handleLinkAttendanceToEvent = async () => {
    if (!selectedEventIdForLink) return;

    const selectedEvent =
      eventCandidates.find((event) => event.id === selectedEventIdForLink) ??
      null;

    if (linkContext === 'draft') {
      setDraftLinkedEventId(selectedEventIdForLink);
      setLinkedEvent(selectedEvent);
      setLinkModalOpen(false);
      return;
    }

    if (!selectedSession) return;

    const linked = await linkSessionToEvent(
      selectedSession.id,
      selectedEventIdForLink,
    );
    if (linked) {
      setLinkModalOpen(false);
    }
  };

  const handleModalPrimaryEnter = (
    event: React.KeyboardEvent<HTMLDivElement>,
    action: () => void,
    disabled?: boolean,
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (disabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'TEXTAREA') return;
    event.preventDefault();
    action();
  };

  const displayDate = isDraftSession
    ? draftDate
    : selectedSession?.meeting_date;

  const requiresMeetingSelection = !startedAttendanceFlow;

  return (
    <AttendancePageShell
      projectId={projectId}
      title="Attendance"
      description="Mark attendance for your meetings and track who showed up."
    >
      {/* ── datalist for name autocomplete ── */}
      <datalist id="attendance-name-suggestions">
        {allKnownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* ── Landing: choose new or edit previous ── */}
      {requiresMeetingSelection ? (
        <div className="flex min-h-[40vh] items-center justify-center py-8">
          <div className="w-full max-w-lg space-y-4">
            <div className="mb-6 space-y-1 text-center">
              <h2 className="text-xl font-semibold">
                What would you like to do?
              </h2>
              <p className="text-muted-foreground text-sm">
                Take attendance for a new meeting, or review a previous one.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* New meeting button */}
              <button
                type="button"
                onClick={handleNewMeeting}
                className="border-border/70 bg-card hover:bg-muted/40 hover:border-border group flex min-h-[300px] flex-col items-start justify-between gap-5 rounded-2xl border p-8 text-left transition-all"
              >
                <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
                  <Plus className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-foreground text-xl font-semibold">
                    New meeting
                  </div>
                  <div className="text-muted-foreground text-base leading-relaxed">
                    Take attendance for a meeting happening today or in the
                    past.
                  </div>
                </div>
              </button>

              {/* Edit previous button */}
              <button
                type="button"
                onClick={() => {
                  setStartedAttendanceFlow(true);
                  setEditPreviousSelectedId(sessions[0]?.id ?? '');
                  setEditPreviousModalOpen(true);
                }}
                disabled={sessions.length === 0}
                className="border-border/70 bg-card hover:bg-muted/40 hover:border-border group flex min-h-[300px] flex-col items-start justify-between gap-5 rounded-2xl border p-8 text-left transition-all disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="text-foreground text-xl font-semibold">
                    Edit previous meeting
                  </div>
                  <div className="text-muted-foreground text-base leading-relaxed">
                    {sessions.length === 0
                      ? 'No previous meetings yet.'
                      : `Review or update attendance from ${sessions.length} past meeting${sessions.length === 1 ? '' : 's'}.`}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Top bar (hidden until a session is active) ── */}
      <div
        className={cn(
          'border-border/70 bg-background/80 sticky top-4 z-20 min-w-0 space-y-0 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur',
          requiresMeetingSelection && 'hidden',
        )}
      >
        {/* Row 1: meeting info + action buttons */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: meeting identity */}
          <div className="min-w-0 flex-1 space-y-1">
            {isDraftSession ? (
              <div className="space-y-0.5">
                <div className="text-lg font-semibold">
                  {draftTitle || defaultSessionTitle(draftDate)}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarDays className="h-3 w-3" />
                  {draftDate ? formatReadableDate(draftDate) : '—'}
                  <span className="ml-1 font-medium text-orange-500">
                    (unsaved meeting)
                  </span>
                </div>
                {linkedEvent ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      Linked to event
                    </span>
                    <span className="text-foreground font-medium">
                      {linkedEvent.title}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : selectedSession ? (
              editingMeetingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    ref={meetingNameInputRef}
                    value={meetingNameDraft}
                    maxLength={120}
                    className="h-9 w-full max-w-md text-base font-semibold"
                    onChange={(e) => setMeetingNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleMeetingRename();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
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
                    {renamingSessionId === selectedSession.id
                      ? 'Saving...'
                      : 'Save'}
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
                <div className="space-y-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-ml-1 h-7 w-7"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setConfirmLeaveOpen(true);
                        return;
                      }
                      setStartedAttendanceFlow(false);
                      setSelectedSessionId(null);
                    }}
                    disabled={savingAttendance}
                    aria-label="Back to attendance options"
                    title="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="min-w-0 text-lg font-semibold break-words">
                      {selectedSession.title}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                      onClick={() => setEditingMeetingName(true)}
                      aria-label="Rename meeting"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <CalendarDays className="h-3 w-3" />
                    {formatReadableDate(selectedSession.meeting_date)}
                  </div>
                  {linkedEvent ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        Linked to event
                      </span>
                      <span className="text-foreground font-medium">
                        {linkedEvent.title}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
          </div>

          {/* Right: save status + buttons */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                hasUnsavedChanges
                  ? 'border-2 border-orange-500 text-orange-500'
                  : 'border-border/70 text-muted-foreground',
              )}
            >
              {hasUnsavedChanges ? (
                <TriangleAlert className="h-3.5 w-3.5" />
              ) : null}
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
              onClick={() => void handleSaveClick()}
              disabled={!hasUnsavedChanges || savingAttendance}
            >
              {savingAttendance
                ? 'Saving...'
                : isDraftSession
                  ? 'Create New Meeting'
                  : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                openLinkModal(isDraftSession ? 'draft' : 'session')
              }
              disabled={savingAttendance}
            >
              {linkedEvent ? 'Change linked event' : 'Link to event'}
            </Button>
            {selectedSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                disabled={savingAttendance}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        {/* Row 2: tools toggle */}
        <div className="border-border/70 mt-3 flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-end lg:justify-between">
          <div />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
              onClick={() => setToolsOpen((open) => !open)}
            >
              {toolsOpen ? 'Hide tools' : 'Search, filter & add attendees'}
            </button>
          </div>
        </div>

        {/* Collapsible tools panel */}
        {toolsOpen ? (
          <div className="border-border/70 mt-3 grid gap-3 border-t pt-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Search
              </div>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4" />
                <Input
                  className="pl-9"
                  value={searchQuery}
                  list="attendance-name-suggestions"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Add attendee manually
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  ref={manualInputRef}
                  value={manualAttendeeName}
                  maxLength={80}
                  onChange={(e) => setManualAttendeeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddManualAttendee();
                    }
                  }}
                  placeholder="Type name, press Enter"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={handleAddManualAttendee}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    openLinkModal(isDraftSession ? 'draft' : 'session')
                  }
                >
                  Link to event
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Filter by status
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-start xl:justify-end">
              {canClearFilters ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : (
                <div className="text-muted-foreground text-xs">
                  No filters active.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedSession?.notes && !requiresMeetingSelection ? (
        <div className="border-border/70 bg-card text-muted-foreground rounded-xl border px-4 py-3 text-sm">
          <span className="text-foreground font-medium">Meeting note:</span>{' '}
          {selectedSession.notes}
        </div>
      ) : null}

      {/* ── Attendance list (hidden until session is active) ── */}
      <Card
        className={cn(
          'border-border/70 min-w-0 overflow-hidden shadow-sm',
          requiresMeetingSelection && 'hidden',
        )}
      >
        <CardContent className="p-0">
          <div className="border-border/70 border-b px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">Attendance list</div>
                <div className="text-muted-foreground text-xs">
                  {filteredRows.length} attendee
                  {filteredRows.length === 1 ? '' : 's'} shown
                  {canClearFilters ? ' (filtered)' : ''}
                </div>
              </div>
              {displayDate ? (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarDays className="h-3 w-3" />
                  {formatReadableDate(displayDate)}
                  {isDraftSession ? (
                    <span className="ml-1 font-medium text-orange-500">
                      (unsaved meeting)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-x-hidden overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="bg-muted/40 h-20 animate-pulse rounded-xl"
                  />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="space-y-4 px-4 py-14 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {attendanceRows.length === 0
                      ? 'No attendees yet'
                      : 'No attendees match the current filters'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {attendanceRows.length === 0
                      ? 'Add someone manually, or manage your roster from the members page.'
                      : 'Try clearing the filters to see all attendees.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {attendanceRows.length === 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setToolsOpen(true);
                        requestAnimationFrame(() =>
                          manualInputRef.current?.focus(),
                        );
                      }}
                    >
                      Add attendee
                    </Button>
                  ) : null}
                  <Button asChild variant="outline">
                    <Link
                      href={`/home/projects/${encodeURIComponent(projectId)}/members`}
                    >
                      Manage roster
                    </Link>
                  </Button>
                  {canClearFilters ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="divide-border/60 divide-y">
                {filteredRows.map((row) => {
                  const isChanged = changedRowKeys.has(row.key);
                  return (
                    <div
                      key={row.key}
                      className="hover:bg-muted/20 px-4 py-3 transition-colors"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div className="min-w-0 text-sm font-semibold break-words">
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
                              <span className="text-xs font-medium text-orange-700">
                                Unsaved
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                          <AttendanceStatusSelector
                            value={row.status}
                            onChange={(status) =>
                              setAttendanceStatus(row.key, status)
                            }
                          />
                          {!row.is_roster ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeManualAttendee(row.key)}
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

      {/* ══════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════ */}

      {/* ── Link attendance to event modal ── */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link attendance to an event?</DialogTitle>
            <DialogDescription>
              {linkContext === 'draft'
                ? 'Choose an event now and it will be saved with this attendance meeting.'
                : 'Choose an event to associate with this attendance meeting.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Search nearby events
              </label>
              <div className="mt-2">
                <Input
                  placeholder="Search events by title"
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Nearby events
              </label>
              <div className="max-h-72 overflow-auto rounded-md border">
                {eventCandidates.filter((event) => {
                  const query = eventSearchQuery.trim().toLowerCase();
                  if (!query) return true;
                  return event.title.toLowerCase().includes(query);
                }).length === 0 ? (
                  <div className="text-muted-foreground p-4 text-sm">
                    No nearby events found.
                  </div>
                ) : (
                  eventCandidates
                    .filter((event) => {
                      const query = eventSearchQuery.trim().toLowerCase();
                      if (!query) return true;
                      return event.title.toLowerCase().includes(query);
                    })
                    .map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className={cn(
                          'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0',
                          selectedEventIdForLink === event.id
                            ? 'bg-muted/60'
                            : 'hover:bg-muted/30',
                        )}
                        onClick={() => setSelectedEventIdForLink(event.id)}
                      >
                        <input
                          type="radio"
                          name="link-event"
                          checked={selectedEventIdForLink === event.id}
                          onChange={() => setSelectedEventIdForLink(event.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {event.title}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(event.start_at).toLocaleString()} ·{' '}
                            {event.location || 'No location'}
                          </div>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLinkModalOpen(false);
                setSelectedEventIdForLink(null);
              }}
            >
              Skip linking
            </Button>
            <Button
              type="button"
              disabled={!selectedEventIdForLink}
              onClick={() => {
                void handleLinkAttendanceToEvent();
              }}
            >
              {linkContext === 'draft' ? 'Use this event' : 'Save link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Meeting Modal ── */}
      <Dialog open={newMeetingModalOpen} onOpenChange={setNewMeetingModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) => handleModalPrimaryEnter(e, handleConfirmNewMeeting)}
        >
          <DialogHeader>
            <DialogTitle>New Meeting</DialogTitle>
            <DialogDescription>
              Set the date and name for this meeting before marking attendance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-meeting-date">Meeting date</Label>
              <Input
                id="new-meeting-date"
                type="date"
                value={newMeetingModalDate}
                onChange={(e) => setNewMeetingModalDate(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Meeting name</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewMeetingModalNameChoice('auto')}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    newMeetingModalNameChoice === 'auto'
                      ? 'border-primary bg-primary/5 text-foreground ring-primary/30 font-medium ring-1'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30',
                  )}
                >
                  <div className="font-medium">Auto</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {defaultSessionTitle(
                      newMeetingModalDate ||
                        new Date().toISOString().slice(0, 10),
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMeetingModalNameChoice('custom')}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    newMeetingModalNameChoice === 'custom'
                      ? 'border-primary bg-primary/5 text-foreground ring-primary/30 font-medium ring-1'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30',
                  )}
                >
                  <div className="font-medium">Custom name</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    e.g. Weekly Standup
                  </div>
                </button>
              </div>

              {newMeetingModalNameChoice === 'custom' ? (
                <Input
                  autoFocus
                  value={newMeetingModalCustomName}
                  maxLength={120}
                  placeholder="Enter a meeting name…"
                  onChange={(e) => setNewMeetingModalCustomName(e.target.value)}
                  className="mt-2"
                />
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewMeetingModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmNewMeeting}
              disabled={
                newMeetingModalNameChoice === 'custom' &&
                !newMeetingModalCustomName.trim()
              }
            >
              Start Taking Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Previous Meeting Modal ── */}
      <Dialog
        open={editPreviousModalOpen}
        onOpenChange={setEditPreviousModalOpen}
      >
        <DialogContent
          className="sm:max-w-md"
          onKeyDown={(e) =>
            handleModalPrimaryEnter(
              e,
              () => {
                if (!editPreviousSelectedId) return;
                setEditPreviousModalOpen(false);
                setSelectedSessionId(editPreviousSelectedId);
              },
              !editPreviousSelectedId,
            )
          }
        >
          <DialogHeader>
            <DialogTitle>Edit previous meeting</DialogTitle>
            <DialogDescription>
              Select a past meeting to view or update its attendance records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No previous meetings found.
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setEditPreviousSelectedId(session.id)}
                    className={cn(
                      'w-full rounded-lg border px-3.5 py-3 text-left text-sm transition-colors',
                      editPreviousSelectedId === session.id
                        ? 'border-primary bg-primary/5 ring-primary/30 ring-1'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <div className="font-medium">{session.title}</div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <CalendarDays className="h-3 w-3" />
                      {formatReadableDate(session.meeting_date)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditPreviousModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editPreviousSelectedId}
              onClick={() => {
                if (!editPreviousSelectedId) return;
                setEditPreviousModalOpen(false);
                setSelectedSessionId(editPreviousSelectedId);
              }}
            >
              Open Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete meeting modal ── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent
          onKeyDown={(e) =>
            handleModalPrimaryEnter(
              e,
              () => void handleDeleteMeeting(),
              !selectedSession || deletingSessionId === selectedSession.id,
            )
          }
        >
          <DialogHeader>
            <DialogTitle>Delete meeting?</DialogTitle>
            <DialogDescription>
              This will permanently remove this meeting and all its attendance
              entries. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deletingSessionId === selectedSession?.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteMeeting()}
              disabled={
                !selectedSession || deletingSessionId === selectedSession.id
              }
            >
              {deletingSessionId === selectedSession?.id
                ? 'Deleting...'
                : 'Delete Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unsaved changes / confirm leave modal ── */}
      <Dialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <DialogContent
          onKeyDown={(e) =>
            handleModalPrimaryEnter(e, () => {
              setConfirmLeaveOpen(false);
              if (pendingSessionId) {
                setSelectedSessionId(pendingSessionId);
                setPendingSessionId(null);
                return;
              }
              if (pendingCreateNewMeeting) {
                setPendingCreateNewMeeting(false);
                setNewMeetingModalDate(new Date().toISOString().slice(0, 10));
                setNewMeetingModalNameChoice('auto');
                setNewMeetingModalCustomName('');
                setNewMeetingModalOpen(true);
                return;
              }
              if (pendingHref) {
                const href = pendingHref;
                setPendingHref(null);
                window.location.href = href;
              }
            })
          }
        >
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved attendance changes. Leaving now will discard
              them. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmLeaveOpen(false);
                setPendingHref(null);
                setPendingSessionId(null);
                setPendingCreateNewMeeting(false);
              }}
            >
              Stay
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmLeaveOpen(false);
                if (pendingSessionId) {
                  setSelectedSessionId(pendingSessionId);
                  setPendingSessionId(null);
                  return;
                }
                if (pendingCreateNewMeeting) {
                  setPendingCreateNewMeeting(false);
                  setNewMeetingModalDate(new Date().toISOString().slice(0, 10));
                  setNewMeetingModalNameChoice('auto');
                  setNewMeetingModalCustomName('');
                  setNewMeetingModalOpen(true);
                  return;
                }
                if (pendingHref) {
                  const href = pendingHref;
                  setPendingHref(null);
                  window.location.href = href;
                }
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Duplicate title resolution modal ── */}
      <Dialog
        open={meetingNameModalOpen}
        onOpenChange={setMeetingNameModalOpen}
      >
        <DialogContent
          onKeyDown={(e) =>
            handleModalPrimaryEnter(
              e,
              () => void confirmMeetingNameAndSave(),
              savingAttendance ||
                (nameMeetingChoice === 'yes' && !newMeetingName.trim()),
            )
          }
        >
          <DialogHeader>
            <DialogTitle>Meeting name conflict</DialogTitle>
            <DialogDescription>
              A meeting with the same date and title already exists. Please
              choose a different name.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newMeetingName}
            onChange={(e) => setNewMeetingName(e.target.value)}
            maxLength={120}
            placeholder="Enter a unique meeting name"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMeetingNameModalOpen(false)}
              disabled={savingAttendance}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmMeetingNameAndSave()}
              disabled={savingAttendance || !newMeetingName.trim()}
            >
              {savingAttendance ? 'Saving...' : 'Create New Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttendancePageShell>
  );
}

function nextDuplicateMeetingTitle(
  sessions: Array<{ meeting_date: string; title: string }>,
  meetingDate: string,
  baseTitle: string,
) {
  const escaped = baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixPattern = new RegExp(`^${escaped} #(\\d+)$`);
  let maxSuffix = 1;
  sessions.forEach((session) => {
    if (session.meeting_date !== meetingDate) return;
    if (session.title === baseTitle) {
      maxSuffix = Math.max(maxSuffix, 1);
      return;
    }
    const match = session.title.match(suffixPattern);
    if (!match) return;
    const suffix = Number(match[1]);
    if (!Number.isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
  });
  return `${baseTitle} #${maxSuffix + 1}`;
}
