'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';

type EventRecord = {
  id: string;
  project_id: string;
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
  location: string;
  rsvpUrl: string;
  visibility: 'public' | 'members';
};

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: '',
  rsvpUrl: '',
  visibility: 'members',
};

export default function EventsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canCreateEvents, setCanCreateEvents] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const fetchEvents = async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/events`, {
          credentials: 'include',
        });

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
    setForm({
      ...EMPTY_FORM,
      startAt: toDateTimeLocalInput(new Date()),
    });
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

    if (!form.startAt) {
      toast.error('Choose a start date and time');
      return;
    }

    const startAt = normalizeDateTimeLocal(form.startAt);
    const endAt = normalizeDateTimeLocal(form.endAt);

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
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/events`, {
        method: 'POST',
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
          rsvp_url: form.rsvpUrl.trim() || null,
          status: 'scheduled',
          visibility: form.visibility,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        event?: EventRecord;
      };

      if (!response.ok || !payload.event) {
        throw new Error(payload.error || 'Failed to create event');
      }

      setEvents((current) => sortEvents([payload.event as EventRecord, ...current]));
      setCreateModalOpen(false);
      setForm(EMPTY_FORM);
      toast.success('Event created');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create event';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Manage upcoming meetings, tournaments, and club sessions.
          </p>
        </div>

        {canCreateEvents ? (
          <Button type="button" onClick={openCreateModal}>
            + Create Event
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>
            Review scheduled events and keep the club calendar current.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`event-loading-${index}`} className="rounded-md border p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
              </div>
            ))}

          {!loading && events.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No events scheduled.
            </div>
          )}

	          {!loading &&
	            events.map((event) => (
	              <Card key={event.id}>
	                <CardContent className="flex items-center justify-between gap-4 p-6">
	                  <div>
	                    <h4 className="text-lg font-semibold">{event.title}</h4>
	                    <p className="text-sm text-muted-foreground">{formatEventSummary(event)}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <RsvpStat label="Going" value={event.rsvp_stats?.going ?? 0} />
                        <RsvpStat label="Maybe" value={event.rsvp_stats?.maybe ?? 0} />
                        <RsvpStat label="Not going" value={event.rsvp_stats?.not_going ?? 0} />
                        <RsvpStat label="Total" value={event.rsvp_stats?.total ?? 0} />
                      </div>
	                  </div>
	                  <Button variant="outline" size="sm" disabled>
	                    Manage
	                  </Button>
                </CardContent>
              </Card>
            ))}
        </CardContent>
      </Card>

      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Fill out the event details, then create it for the club calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="event-title" className="text-xs text-muted-foreground">
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
              <label htmlFor="event-description" className="text-xs text-muted-foreground">
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
              <div className="text-right text-xs text-muted-foreground">
                {form.description.length}/3000
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="event-start" className="text-xs text-muted-foreground">
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
                <label htmlFor="event-end" className="text-xs text-muted-foreground">
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="event-location" className="text-xs text-muted-foreground">
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
                <label htmlFor="event-rsvp" className="text-xs text-muted-foreground">
                  RSVP URL
                </label>
                <Input
                  id="event-rsvp"
                  type="url"
                  value={form.rsvpUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      rsvpUrl: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="event-visibility" className="text-xs text-muted-foreground">
                Visibility
              </label>
              <select
                id="event-visibility"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-2xs outline-none"
                value={form.visibility}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    visibility: event.target.value === 'public' ? 'public' : 'members',
                  }))
                }
              >
                <option value="members">Members only</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void createEvent()} disabled={saving}>
                {saving ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sortEvents(items: EventRecord[]) {
  return [...items].sort((a, b) => {
    const dateDelta = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    if (dateDelta !== 0) return dateDelta;

    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
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
    <span className="rounded-full bg-muted px-2.5 py-1">
      {label}: {value}
    </span>
  );
}
