'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

type Theme = {
  surface: string;
  border: string;
  accent: string;
  accentMuted: string;
  accentSoft: string;
  accentText: string;
  cardText: string;
  mutedText: string;
};

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
  rsvp_url?: string | null;
  rsvpUrl?: string | null;
};

type RsvpStatus = 'going' | 'maybe' | 'not_going';

type RsvpStats = {
  going: number;
  maybe: number;
  not_going: number;
  total: number;
};

type EventRsvpState = {
  status: RsvpStatus | null;
  stats: RsvpStats | null;
};

const STATUS_LABEL: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: "Can't",
};

const STATUS_THEME: Record<
  RsvpStatus,
  {
    surface: string;
    text: string;
    border: string;
    activeVariant: 'success' | 'warning' | 'destructive';
    inactiveVariant: 'successOutline' | 'warningOutline' | 'destructiveOutline';
  }
> = {
  going: {
    surface: '#f0fdf4',
    text: '#166534',
    border: '#86efac',
    activeVariant: 'success',
    inactiveVariant: 'successOutline',
  },
  maybe: {
    surface: '#fffbeb',
    text: '#92400e',
    border: '#fcd34d',
    activeVariant: 'warning',
    inactiveVariant: 'warningOutline',
  },
  not_going: {
    surface: '#fef2f2',
    text: '#991b1b',
    border: '#fca5a5',
    activeVariant: 'destructive',
    inactiveVariant: 'destructiveOutline',
  },
};

export function PublicEventsCalendar({
  events,
  allEvents,
  theme,
  showRsvp = true,
  isAuthenticated,
  defaultResponderName,
}: {
  events: EventItem[];
  allEvents?: EventItem[];
  theme: Theme;
  showRsvp?: boolean;
  isAuthenticated?: boolean;
  defaultResponderName?: string | null;
}) {
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rsvpByEventId, setRsvpByEventId] = useState<
    Record<string, EventRsvpState>
  >({});
  const [savingByEventId, setSavingByEventId] = useState<
    Record<string, RsvpStatus | null>
  >({});
  const [errorByEventId, setErrorByEventId] = useState<
    Record<string, string | null>
  >({});

  const scheduleEvents = useMemo(
    () =>
      [...(allEvents ?? events)].sort((a, b) => {
        if (!a.start_at) return 1;
        if (!b.start_at) return -1;
        return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      }),
    [allEvents, events],
  );

  const anchorDate =
    scheduleEvents.length > 0 && scheduleEvents[0]?.start_at
      ? new Date(scheduleEvents[0].start_at)
      : new Date();
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarEvents = useMemo(
    () =>
      events
        .filter((event) => event?.start_at)
        .sort((a, b) => {
          return (
            new Date(a.start_at as string).getTime() -
            new Date(b.start_at as string).getTime()
          );
        }),
    [events],
  );

  const resolveGuestToken = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const existing = window.localStorage.getItem(
      'public-event-rsvp-guest-token',
    );
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem('public-event-rsvp-guest-token', generated);
    return generated;
  }, []);

  const resolveResponderName = useCallback(() => {
    if (typeof window === 'undefined') return defaultResponderName || 'Guest';
    const existing = window.localStorage.getItem('public-event-rsvp-name');
    if (existing) return existing;
    const fallback =
      defaultResponderName || (isAuthenticated ? 'Member' : 'Guest');
    window.localStorage.setItem('public-event-rsvp-name', fallback);
    return fallback;
  }, [defaultResponderName, isAuthenticated]);

  const loadCurrentRsvp = useCallback(
    async (eventId: string) => {
      const guestToken = resolveGuestToken();
      const response = await fetch(
        `/api/public/events/${eventId}/rsvp?guestToken=${encodeURIComponent(guestToken)}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        currentResponse?: { status?: string } | null;
        stats?: Partial<RsvpStats> | null;
      };

      const currentStatus = normalizeStatus(payload.currentResponse?.status);
      const stats = normalizeStats(payload.stats);

      setRsvpByEventId((current) => ({
        ...current,
        [eventId]: {
          status: currentStatus,
          stats,
        },
      }));
    },
    [resolveGuestToken],
  );

  useEffect(() => {
    let cancelled = false;

    const missingEventIds = scheduleEvents
      .map((event) => event.id)
      .filter((eventId) => rsvpByEventId[eventId] === undefined);

    if (missingEventIds.length === 0) return;

    const run = async () => {
      for (const eventId of missingEventIds) {
        if (cancelled) break;

        try {
          await loadCurrentRsvp(eventId);
        } catch {
          // best-effort preload
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCurrentRsvp, rsvpByEventId, scheduleEvents]);

  const submitRsvp = useCallback(
    async (event: EventItem, status: RsvpStatus) => {
      try {
        setSavingByEventId((current) => ({
          ...current,
          [event.id]: status,
        }));
        setErrorByEventId((current) => ({
          ...current,
          [event.id]: null,
        }));

        const response = await fetch(`/api/public/events/${event.id}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            responderName: resolveResponderName(),
            guestToken: resolveGuestToken(),
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          currentResponse?: { status?: string } | null;
          stats?: Partial<RsvpStats> | null;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to save RSVP');
        }

        const savedStatus =
          normalizeStatus(payload.currentResponse?.status) ?? status;
        const stats = normalizeStats(payload.stats);

        setRsvpByEventId((current) => ({
          ...current,
          [event.id]: {
            status: savedStatus,
            stats,
          },
        }));

        toast.success(`${event.title}: ${STATUS_LABEL[savedStatus]} saved`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to save RSVP';
        setErrorByEventId((current) => ({
          ...current,
          [event.id]: message,
        }));
        toast.error(message);
      } finally {
        setSavingByEventId((current) => ({
          ...current,
          [event.id]: null,
        }));
      }
    },
    [resolveGuestToken, resolveResponderName],
  );

  const openEventModal = (event: EventItem) => {
    setSelectedEvent(event);
    if (!rsvpByEventId[event.id]) {
      void loadCurrentRsvp(event.id);
    }
  };

  const selectedEventStatus = selectedEvent
    ? (rsvpByEventId[selectedEvent.id]?.status ?? null)
    : null;
  const selectedEventStats = selectedEvent
    ? (rsvpByEventId[selectedEvent.id]?.stats ?? null)
    : null;
  const selectedEventSaving = selectedEvent
    ? (savingByEventId[selectedEvent.id] ?? null)
    : null;
  const selectedEventError = selectedEvent
    ? (errorByEventId[selectedEvent.id] ?? null)
    : null;

  return (
    <>
      <section
        className="overflow-hidden rounded-2xl border"
        style={{
          background: theme.surface,
          borderColor: theme.border,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4 md:px-6"
          style={{ borderColor: theme.border }}
        >
          <div>
            <h3
              className="font-heading text-xl font-semibold"
              style={{ color: theme.cardText }}
            >
              {format(monthStart, 'MMMM yyyy')}
            </h3>
            <p className="text-sm" style={{ color: theme.mutedText }}>
              Public club calendar
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-7 border-b"
          style={{ borderColor: theme.border }}
        >
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="px-2 py-3 text-center text-xs font-semibold uppercase"
              style={{ color: theme.mutedText }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = calendarEvents.filter((event) =>
              event?.start_at
                ? isSameDay(new Date(event.start_at), day)
                : false,
            );
            const inMonth = isSameMonth(day, monthStart);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="min-h-28 border-r border-b p-2 md:min-h-32 md:p-3"
                style={{
                  borderColor: theme.border,
                  background: today ? theme.accentMuted : theme.surface,
                  opacity: inMonth ? 1 : 0.45,
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      background: today ? theme.accent : 'transparent',
                      color: today ? '#ffffff' : theme.cardText,
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => {
                    const status = rsvpByEventId[event.id]?.status ?? null;
                    const statusTheme = status ? STATUS_THEME[status] : null;

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className="w-full cursor-pointer rounded-md border px-2 py-1 text-left text-xs hover:opacity-90"
                        style={{
                          background: statusTheme
                            ? statusTheme.surface
                            : theme.accentSoft,
                          color: statusTheme
                            ? statusTheme.text
                            : theme.accentText,
                          borderColor: statusTheme
                            ? statusTheme.border
                            : 'transparent',
                        }}
                        onClick={() => openEventModal(event)}
                        title={`${format(new Date(event.start_at as string), 'p')} - ${event.title}`}
                      >
                        <div className="truncate font-semibold">
                          {event.title}
                        </div>
                        <div className="truncate opacity-80">
                          {format(new Date(event.start_at as string), 'p')}
                        </div>
                        {status ? (
                          <div className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase">
                            {STATUS_LABEL[status]}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}

                  {dayEvents.length > 2 ? (
                    <div
                      className="px-1 text-xs font-medium"
                      style={{ color: theme.mutedText }}
                    >
                      +{dayEvents.length - 2} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border"
        style={{
          background: theme.surface,
          borderColor: theme.border,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4 md:px-6"
          style={{ borderColor: theme.border }}
        >
          <div>
            <h3
              className="font-heading text-xl font-semibold"
              style={{ color: theme.cardText }}
            >
              All Events
            </h3>
            <p className="text-sm" style={{ color: theme.mutedText }}>
              Full public schedule
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ background: theme.accentMuted }}>
              <tr className="border-b" style={{ borderColor: theme.border }}>
                <th
                  className="px-4 py-2.5 text-left font-semibold md:px-6"
                  style={{ color: theme.mutedText }}
                >
                  Date
                </th>
                <th
                  className="px-4 py-2.5 text-left font-semibold md:px-6"
                  style={{ color: theme.mutedText }}
                >
                  Time
                </th>
                <th
                  className="px-4 py-2.5 text-left font-semibold md:px-6"
                  style={{ color: theme.mutedText }}
                >
                  Event
                </th>
                <th
                  className="px-4 py-2.5 text-left font-semibold md:px-6"
                  style={{ color: theme.mutedText }}
                >
                  Location
                </th>
                <th
                  className="px-4 py-2.5 text-left font-semibold md:px-6"
                  style={{ color: theme.mutedText }}
                >
                  RSVP
                </th>
              </tr>
            </thead>
            <tbody>
              {scheduleEvents.map((event) => {
                const status = rsvpByEventId[event.id]?.status ?? null;
                const stats = rsvpByEventId[event.id]?.stats ?? null;
                const savingStatus = savingByEventId[event.id] ?? null;
                const saveError = errorByEventId[event.id] ?? null;

                return (
                  <tr
                    key={event.id}
                    className="border-b align-top last:border-b-0"
                    style={{ borderColor: theme.border }}
                  >
                    <td
                      className="px-4 py-4 whitespace-nowrap md:px-6"
                      style={{ color: theme.cardText }}
                    >
                      {formatEventDate(event.start_at)}
                    </td>
                    <td
                      className="px-4 py-4 whitespace-nowrap md:px-6"
                      style={{ color: theme.mutedText }}
                    >
                      {formatEventTimeRange(event.start_at, event.end_at)}
                    </td>
                    <td className="px-4 py-4 md:px-6">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => openEventModal(event)}
                        style={{ color: theme.cardText }}
                      >
                        <div className="font-semibold hover:underline">
                          {event.title}
                        </div>
                      </button>
                      {event.description ? (
                        <p
                          className="mt-1 line-clamp-2 text-sm"
                          style={{ color: theme.mutedText }}
                        >
                          {event.description}
                        </p>
                      ) : null}
                    </td>
                    <td
                      className="px-4 py-4 md:px-6"
                      style={{ color: theme.mutedText }}
                    >
                      {event.location || 'TBA'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap md:px-6">
                      {showRsvp ? (
                        <>
                          <RsvpButtonGroup
                            currentStatus={status}
                            savingStatus={savingStatus}
                            onSelect={(nextStatus) => {
                              void submitRsvp(event, nextStatus);
                            }}
                          />
                          {saveError ? (
                            <div
                              className="mt-1 text-[11px]"
                              style={{ color: '#dc2626' }}
                            >
                              {saveError}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ color: theme.mutedText }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      >
        {selectedEvent ? (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedEvent.title}</DialogTitle>
              <DialogDescription>
                {formatEventDate(selectedEvent.start_at)} |{' '}
                {formatEventTimeRange(
                  selectedEvent.start_at,
                  selectedEvent.end_at,
                )}
              </DialogDescription>
            </DialogHeader>

            <div
              className="space-y-2 text-sm"
              style={{ color: theme.mutedText }}
            >
              <p>{selectedEvent.location || 'TBA'}</p>
              {selectedEvent.description ? (
                <p style={{ color: theme.cardText }}>
                  {selectedEvent.description}
                </p>
              ) : null}
              {selectedEventStatus ? (
                <div
                  className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: STATUS_THEME[selectedEventStatus].surface,
                    color: STATUS_THEME[selectedEventStatus].text,
                  }}
                >
                  Selected: {STATUS_LABEL[selectedEventStatus]}
                </div>
              ) : null}
              {selectedEventStats ? (
                <div className="text-xs">
                  Going {selectedEventStats.going} | Maybe{' '}
                  {selectedEventStats.maybe} | Can&apos;t{' '}
                  {selectedEventStats.not_going}
                </div>
              ) : null}
            </div>

            {showRsvp ? (
              <RsvpButtonGroup
                currentStatus={selectedEventStatus}
                savingStatus={selectedEventSaving}
                onSelect={(status) => {
                  void submitRsvp(selectedEvent, status);
                }}
              />
            ) : null}

            {selectedEventError ? (
              <p className="text-sm" style={{ color: '#dc2626' }}>
                {selectedEventError}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function normalizeStatus(value: unknown): RsvpStatus | null {
  if (value === 'going' || value === 'maybe' || value === 'not_going') {
    return value;
  }

  return null;
}

function normalizeStats(
  value: Partial<RsvpStats> | null | undefined,
): RsvpStats | null {
  if (!value) return null;
  return {
    going: Number(value.going ?? 0),
    maybe: Number(value.maybe ?? 0),
    not_going: Number(value.not_going ?? 0),
    total: Number(value.total ?? 0),
  };
}

function RsvpButtonGroup({
  currentStatus,
  savingStatus,
  onSelect,
}: {
  currentStatus: RsvpStatus | null;
  savingStatus: RsvpStatus | null;
  onSelect: (status: RsvpStatus) => void;
}) {
  const disabled = savingStatus !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={
          currentStatus === 'going'
            ? STATUS_THEME.going.activeVariant
            : STATUS_THEME.going.inactiveVariant
        }
        disabled={disabled}
        onClick={() => onSelect('going')}
      >
        {savingStatus === 'going' ? 'Saving...' : 'Going'}
      </Button>

      <Button
        type="button"
        size="sm"
        variant={
          currentStatus === 'maybe'
            ? STATUS_THEME.maybe.activeVariant
            : STATUS_THEME.maybe.inactiveVariant
        }
        disabled={disabled}
        onClick={() => onSelect('maybe')}
      >
        {savingStatus === 'maybe' ? 'Saving...' : 'Maybe'}
      </Button>

      <Button
        type="button"
        size="sm"
        variant={
          currentStatus === 'not_going'
            ? STATUS_THEME.not_going.activeVariant
            : STATUS_THEME.not_going.inactiveVariant
        }
        disabled={disabled}
        onClick={() => onSelect('not_going')}
      >
        {savingStatus === 'not_going' ? 'Saving...' : "Can't"}
      </Button>
    </div>
  );
}

function formatEventDate(value: string | null | undefined) {
  if (!value) return 'TBA';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTimeRange(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
) {
  if (!startAt) return 'TBA';
  const start = new Date(startAt);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endAt) return startLabel;
  const end = new Date(endAt);
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${startLabel} - ${endLabel}`;
}
