'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import { CalendarDays, ChevronDown, Pencil, Repeat, Trash } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import {
  DashboardEmptyState,
  DashboardLoadingList,
  DashboardPageHeader,
} from '../_components/dashboard-page-primitives';

type EventRecord = {
  id: string;
  project_id: string;
  series_id?: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  rsvp_url: string | null;
  status: string;
  visibility: string;
  created_at: string | null;
  updated_at: string | null;
  rsvp_stats?: {
    going: number;
    maybe: number;
    not_going: number;
    total: number;
  };
};

type EventForm = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  recurringStartTime: string;
  recurringEndTime: string;
  location: string;
  visibility: 'public' | 'members';
  recurrence: 'none' | 'weekly';
  recurrenceCount: number;
  recurrenceDays: number[];
};

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  recurringStartTime: '',
  recurringEndTime: '',
  location: '',
  visibility: 'members',
  recurrence: 'none',
  recurrenceCount: 8,
  recurrenceDays: [],
};

export default function EventsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>(
    {},
  );
  const [visibilityFilters, setVisibilityFilters] = useState<
    Record<string, boolean>
  >({});
  const EVENT_STATUSES = ['scheduled', 'draft', 'cancelled'];
  const EVENT_VISIBILITIES = ['public', 'members'];
  const [loading, setLoading] = useState(true);
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = events.slice();

    // apply status filters if any selected
    const activeStatuses = Object.entries(statusFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeStatuses.length > 0) {
      result = result.filter((ev) => activeStatuses.includes(ev.status));
    }

    // apply visibility filters if any selected
    const activeVis = Object.entries(visibilityFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeVis.length > 0) {
      result = result.filter((ev) => activeVis.includes(ev.visibility));
    }

    if (!q) return result;
    return result.filter((ev) => ev.title.toLowerCase().includes(q));
  }, [events, searchQuery, statusFilters, visibilityFilters]);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [canCreateEvents, setCanCreateEvents] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventRecord | null>(null);
  const [deleteRecurringSeries, setDeleteRecurringSeries] = useState(false);
  const [editRecurringModalOpen, setEditRecurringModalOpen] = useState(false);
  const [editAllRecurringEvents, setEditAllRecurringEvents] = useState(false);
  const seriesCandidates = selectedEvent
    ? getRecurringSeriesCandidates(events, selectedEvent)
    : [];
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<
    'type' | 'recurring' | 'details'
  >('type');

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const fetchEvents = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/events`,
          {
            credentials: 'include',
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          events?: EventRecord[];
          permissions?: {
            canCreate?: boolean;
          };
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load events');
        }

        if (cancelled) return;

        setEvents(payload.events ?? []);
        setCanCreateEvents(Boolean(payload.permissions?.canCreate));
      } catch (error) {
        if (cancelled) return;

        toast.error('Failed to load events');
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openCreateModal = () => {
    setSelectedEvent(null);
    setForm({
      ...EMPTY_FORM,
      startAt: toDateTimeLocalInput(new Date()),
      recurringStartTime: '18:00',
      recurringEndTime: '19:30',
    });
    setCreateStep('type');
    setCreateModalOpen(true);
  };

  const openEditModal = (ev: EventRecord) => {
    setSelectedEvent(ev);
    setEditAllRecurringEvents(false);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      startAt: toDateTimeLocalInput(new Date(ev.start_at)),
      endAt: ev.end_at ? toDateTimeLocalInput(new Date(ev.end_at)) : '',
      recurringStartTime: toTimeInputValue(new Date(ev.start_at)),
      recurringEndTime: ev.end_at ? toTimeInputValue(new Date(ev.end_at)) : '',
      location: ev.location ?? '',
      visibility: ev.visibility === 'public' ? 'public' : 'members',
      recurrence: 'none',
      recurrenceCount: 8,
      recurrenceDays: [],
    });
    setCreateStep('details');
    setCreateModalOpen(true);
  };

  const createEvent = async () => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }

    const title = form.title.trim();
    if (!title) {
      toast.error('Enter an event title');
      return;
    }

    if (!form.startAt && form.recurrence !== 'weekly') {
      toast.error('Choose a start date and time');
      return;
    }
    let startAt = normalizeDateTimeLocal(form.startAt);
    let endAt = normalizeDateTimeLocal(form.endAt);
    if (form.recurrence === 'weekly' && !selectedEvent) {
      if (!form.recurringStartTime) {
        toast.error('Choose recurring start time');
        return;
      }
      const baseDate = new Date().toISOString().slice(0, 10);
      startAt = normalizeDateTimeLocal(
        `${baseDate}T${form.recurringStartTime}`,
      );
      endAt = form.recurringEndTime
        ? normalizeDateTimeLocal(`${baseDate}T${form.recurringEndTime}`)
        : null;
    }

    if (!startAt) {
      toast.error('Start date is invalid');
      return;
    }

    if (form.endAt && !endAt) {
      toast.error('End date is invalid');
      return;
    }

    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      toast.error('End date must be after the start date');
      return;
    }

    setSaving(true);

    try {
      if (selectedEvent) {
        const seriesCandidates = getRecurringSeriesCandidates(
          events,
          selectedEvent,
        );
        if (seriesCandidates.length > 1 && !editAllRecurringEvents) {
          setEditRecurringModalOpen(true);
          setSaving(false);
          return;
        }

        const targets = editAllRecurringEvents
          ? seriesCandidates
          : [selectedEvent];
        const updatedEvents: EventRecord[] = [];
        for (const target of targets) {
          const response = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(target.id)}`,
            {
              method: 'PATCH',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                title,
                description: form.description.trim() || null,
                start_at: startAt,
                end_at: endAt,
                location: form.location.trim() || null,
                visibility: form.visibility,
              }),
            },
          );

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            event?: EventRecord;
          };

          if (!response.ok || !payload.event) {
            throw new Error(payload.error || 'Failed to update event');
          }
          updatedEvents.push(payload.event as EventRecord);
        }

        setEvents((current) => {
          const map = new Map(updatedEvents.map((e) => [e.id, e]));
          return sortEvents(current.map((it) => map.get(it.id) ?? it));
        });
        setCreateModalOpen(false);
        setSelectedEvent(null);
        setEditAllRecurringEvents(false);
        setForm(EMPTY_FORM);
        toast.success(
          targets.length === 1
            ? 'Event updated'
            : `${targets.length} events updated`,
        );
      } else {
        const createdEvents: EventRecord[] = [];
        const weeklyCount = Math.max(
          1,
          Math.min(52, Math.floor(form.recurrenceCount || 1)),
        );
        // No separate event_series table: record recurrence fields directly on events
        const recurrenceDates =
          form.recurrence === 'weekly' && form.recurrenceDays.length > 0
            ? buildWeeklyRecurringDates(
                startAt,
                form.recurrenceDays,
                weeklyCount,
              )
            : [startAt];
        const occurrences = recurrenceDates.length;

        for (const nextStartAt of recurrenceDates) {
          let nextEndAt: string | null = null;
          if (endAt) {
            const durationMs =
              new Date(endAt).getTime() - new Date(startAt).getTime();
            nextEndAt = new Date(
              new Date(nextStartAt).getTime() + durationMs,
            ).toISOString();
          }

          const response = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/events`,
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                title,
                description: form.description.trim() || null,
                start_at: nextStartAt,
                end_at: nextEndAt,
                location: form.location.trim() || null,
                status: 'scheduled',
                visibility: form.visibility,
                // recurrence metadata stored on the event row
                is_recurring:
                  form.recurrence === 'weekly' &&
                  form.recurrenceDays.length > 0,
                recurrence_days:
                  form.recurrence === 'weekly' && form.recurrenceDays.length > 0
                    ? form.recurrenceDays
                    : null,
                recurrence_type:
                  form.recurrence === 'weekly' ? 'weekly' : 'none',
                recurrence_count:
                  form.recurrence === 'weekly' ? weeklyCount : 1,
                recurrence_start_time:
                  form.recurrence === 'weekly' && form.recurringStartTime
                    ? form.recurringStartTime
                    : null,
                recurrence_end_time:
                  form.recurrence === 'weekly' && form.recurringEndTime
                    ? form.recurringEndTime
                    : null,
              }),
            },
          );

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            event?: EventRecord;
          };

          if (!response.ok || !payload.event) {
            throw new Error(
              payload.error || 'Failed to create recurring events',
            );
          }

          createdEvents.push(payload.event as EventRecord);
        }

        setEvents((current) => sortEvents([...createdEvents, ...current]));
        setCreateModalOpen(false);
        setForm(EMPTY_FORM);
        toast.success(
          occurrences === 1
            ? 'Event created'
            : `${occurrences} recurring events created`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : selectedEvent
            ? 'Failed to update event'
            : 'Failed to create event';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!projectId || !eventToDelete) {
      return;
    }

    setDeletingEventId(eventToDelete.id);

    try {
      const targets = deleteRecurringSeries
        ? getRecurringSeriesCandidates(events, eventToDelete)
        : [eventToDelete];

      for (const target of targets) {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/events/${encodeURIComponent(target.id)}`,
          {
            method: 'DELETE',
            credentials: 'include',
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to delete event');
        }
      }

      setEvents((current) =>
        current.filter(
          (item) => !targets.some((target) => target.id === item.id),
        ),
      );
      setDeleteModalOpen(false);
      setEventToDelete(null);
      setDeleteRecurringSeries(false);
      toast.success(
        targets.length === 1
          ? 'Event deleted'
          : `${targets.length} events deleted`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete event',
      );
    } finally {
      setDeletingEventId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Events"
        description="Manage upcoming meetings, tournaments, and club sessions."
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search events"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Filter
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {EVENT_STATUSES.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={Boolean(statusFilters[status])}
                    onSelect={(e) => {
                      e.preventDefault?.();
                      setStatusFilters((prev) => ({
                        ...prev,
                        [status]: !prev[status],
                      }));
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                        {statusFilters[status] ? (
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
                      <span>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                {EVENT_VISIBILITIES.map((vis) => (
                  <DropdownMenuCheckboxItem
                    key={vis}
                    checked={Boolean(visibilityFilters[vis])}
                    onSelect={(e) => {
                      e.preventDefault?.();
                      setVisibilityFilters((prev) => ({
                        ...prev,
                        [vis]: !prev[vis],
                      }));
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                        {visibilityFilters[vis] ? (
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
                      <span>{vis.charAt(0).toUpperCase() + vis.slice(1)}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreateEvents ? (
              <Button type="button" onClick={openCreateModal}>
                + Create Event
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-3">
        {loading ? <DashboardLoadingList keyPrefix="event-loading" /> : null}

        {!loading && filteredEvents.length === 0 && (
          <DashboardEmptyState message="No events scheduled." />
        )}

        {!loading &&
          filteredEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="hover:bg-muted/40 relative flex items-start justify-between gap-4 p-6 transition-colors">
                <div>
                  <h4 className="text-lg font-semibold">{event.title}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatEventSummary(event)}
                  </p>
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-xs">
                    <RsvpStat
                      label="Going"
                      value={event.rsvp_stats?.going ?? 0}
                    />
                    <RsvpStat
                      label="Maybe"
                      value={event.rsvp_stats?.maybe ?? 0}
                    />
                    <RsvpStat
                      label="Not going"
                      value={event.rsvp_stats?.not_going ?? 0}
                    />
                    <RsvpStat
                      label="Total"
                      value={event.rsvp_stats?.total ?? 0}
                    />
                  </div>
                </div>
                {canCreateEvents ? (
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(event)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingEventId === event.id}
                      onClick={() => {
                        setEventToDelete(event);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Create / Edit Modal */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setForm(EMPTY_FORM);
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? 'Edit Event' : 'New Event'}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent
                ? 'Update this event.'
                : createStep === 'type'
                  ? 'Does this event repeat?'
                  : createStep === 'recurring'
                    ? 'Choose which days this repeats on.'
                    : 'Fill out the event details, then create it for the club calendar.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step: type selection */}
          {!selectedEvent && createStep === 'type' && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Choose one option, then continue to event details.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="hover:bg-muted/40 rounded-xl border p-4 text-left transition-colors"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      recurrence: 'none',
                      recurrenceDays: [],
                    }));
                    setCreateStep('details');
                  }}
                >
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <p className="font-medium">No, one-time event</p>
                  <p className="text-muted-foreground text-sm">
                    Create one event on one date.
                  </p>
                </button>
                <button
                  type="button"
                  className="hover:bg-muted/40 rounded-xl border p-4 text-left transition-colors"
                  onClick={() => {
                    const startDay = new Date(
                      normalizeDateTimeLocal(form.startAt) ??
                        new Date().toISOString(),
                    ).getDay();
                    setForm((prev) => ({
                      ...prev,
                      recurrence: 'weekly',
                      recurrenceDays: [startDay],
                    }));
                    setCreateStep('recurring');
                  }}
                >
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Repeat className="h-5 w-5" />
                  </div>
                  <p className="font-medium">Yes, recurring event</p>
                  <p className="text-muted-foreground text-sm">
                    Repeat weekly on selected days.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step: recurring day/count selection */}
          {!selectedEvent && createStep === 'recurring' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs">
                  Repeat on
                </label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {[
                    { label: 'Sun', value: 0 },
                    { label: 'Mon', value: 1 },
                    { label: 'Tue', value: 2 },
                    { label: 'Wed', value: 3 },
                    { label: 'Thu', value: 4 },
                    { label: 'Fri', value: 5 },
                    { label: 'Sat', value: 6 },
                  ].map((day) => {
                    const selected = form.recurrenceDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={`rounded-md border px-2 py-1 text-sm transition-colors ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted/40'}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            recurrenceDays: selected
                              ? prev.recurrenceDays.filter(
                                  (d) => d !== day.value,
                                )
                              : [...prev.recurrenceDays, day.value],
                          }))
                        }
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">
                  Number of meetings
                </label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={form.recurrenceCount}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      recurrenceCount: Number(event.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateStep('type')}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCreateStep('details')}
                  disabled={form.recurrenceDays.length === 0}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step: event details (also used for edit) */}
          {(createStep === 'details' || !!selectedEvent) && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="event-title"
                  className="text-muted-foreground text-xs"
                >
                  Title
                </label>
                <Input
                  id="event-title"
                  value={form.title}
                  maxLength={120}
                  placeholder="Weekly club meeting"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="event-description"
                  className="text-muted-foreground text-xs"
                >
                  Description
                </label>
                <Textarea
                  id="event-description"
                  rows={5}
                  maxLength={3000}
                  placeholder="What is happening at this event?"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
                <div className="text-muted-foreground text-right text-xs">
                  {form.description.length}/3000
                </div>
              </div>

              {form.recurrence === 'weekly' && !selectedEvent ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">
                      Start time
                    </label>
                    <Input
                      type="time"
                      value={form.recurringStartTime}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          recurringStartTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">
                      End time
                    </label>
                    <Input
                      type="time"
                      value={form.recurringEndTime}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          recurringEndTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="event-start"
                      className="text-muted-foreground text-xs"
                    >
                      Start
                    </label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      value={form.startAt}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          startAt: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="event-end"
                      className="text-muted-foreground text-xs"
                    >
                      End
                    </label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      value={form.endAt}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          endAt: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="event-location"
                  className="text-muted-foreground text-xs"
                >
                  Location
                </label>
                <Input
                  id="event-location"
                  value={form.location}
                  placeholder="Main Hall"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="event-visibility"
                  className="text-muted-foreground text-xs"
                >
                  Visibility
                </label>
                <Select
                  value={form.visibility}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: value === 'public' ? 'public' : 'members',
                    }))
                  }
                >
                  <SelectTrigger id="event-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="members">Members only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                {selectedEvent && seriesCandidates.length > 1 ? (
                  <label className="mr-auto flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={editAllRecurringEvents}
                      onCheckedChange={(checked) =>
                        setEditAllRecurringEvents(Boolean(checked))
                      }
                    />
                    Apply changes to all {seriesCandidates.length} matching
                    recurring events
                  </label>
                ) : null}
                {!selectedEvent ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCreateStep(
                        form.recurrence === 'weekly' ? 'recurring' : 'type',
                      )
                    }
                    disabled={saving || createStep === 'type'}
                  >
                    Back
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void createEvent()}
                  disabled={
                    saving ||
                    (form.recurrence === 'weekly' &&
                      form.recurrenceDays.length === 0)
                  }
                >
                  {saving
                    ? selectedEvent
                      ? 'Updating...'
                      : 'Creating...'
                    : selectedEvent
                      ? 'Update Event'
                      : 'Create Event'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setEventToDelete(null);
            setDeleteRecurringSeries(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
            <DialogDescription>
              {eventToDelete
                ? `This will permanently delete "${eventToDelete.title}".`
                : 'This will permanently delete this event.'}
            </DialogDescription>
          </DialogHeader>
          {eventToDelete ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={deleteRecurringSeries}
                onCheckedChange={(checked) =>
                  setDeleteRecurringSeries(Boolean(checked))
                }
              />
              Delete all matching recurring events
            </label>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={!!eventToDelete && deletingEventId === eventToDelete.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteEvent()}
              disabled={!eventToDelete || deletingEventId === eventToDelete.id}
            >
              {eventToDelete && deletingEventId === eventToDelete.id
                ? 'Deleting...'
                : 'Delete Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit recurring confirmation modal */}
      <Dialog
        open={editRecurringModalOpen}
        onOpenChange={setEditRecurringModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply changes to recurring events?</DialogTitle>
            <DialogDescription>
              This event appears to be part of a recurring set. Choose whether
              to update only this event or all matching recurring events.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditRecurringModalOpen(false);
                setEditAllRecurringEvents(false);
                void createEvent();
              }}
            >
              This event only
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditRecurringModalOpen(false);
                setEditAllRecurringEvents(true);
                void createEvent();
              }}
            >
              All recurring events
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sortEvents(items: EventRecord[]) {
  return [...items].sort((a, b) => {
    const dateDelta =
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    if (dateDelta !== 0) return dateDelta;

    return (
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
    );
  });
}

function formatEventSummary(event: EventRecord) {
  const parsed = new Date(event.start_at);
  const startLabel = Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  return `${startLabel} at ${event.location || 'TBA'}`;
}

function buildWeeklyRecurringDates(
  startAtIso: string,
  weekdays: number[],
  weekCount: number,
) {
  const start = new Date(startAtIso);
  const daySet = Array.from(new Set(weekdays)).sort((a, b) => a - b);
  const results: string[] = [];

  for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
    for (const targetDay of daySet) {
      const candidate = new Date(start);
      candidate.setDate(start.getDate() + weekOffset * 7);
      const delta = (targetDay - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + delta);
      if (candidate.getTime() < start.getTime()) continue;
      results.push(candidate.toISOString());
    }
  }

  return results.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function toTimeInputValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getRecurringSeriesCandidates(
  events: EventRecord[],
  seed: EventRecord,
) {
  // Prefer series_id when available (new DB layout)
  if (seed.series_id) {
    return events.filter((e) => e.series_id === seed.series_id);
  }

  const seedStart = new Date(seed.start_at);
  const seedTime = `${seedStart.getUTCHours()}:${seedStart.getUTCMinutes()}`;
  return events.filter((event) => {
    if (event.title !== seed.title) return false;
    if ((event.location ?? '') !== (seed.location ?? '')) return false;
    if (event.visibility !== seed.visibility) return false;
    const start = new Date(event.start_at);
    const time = `${start.getUTCHours()}:${start.getUTCMinutes()}`;
    return time === seedTime;
  });
}

function toDateTimeLocalInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeDateTimeLocal(value: string) {
  if (!value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function RsvpStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="bg-muted rounded-full px-2.5 py-1">
      {label}: {value}
    </span>
  );
}
