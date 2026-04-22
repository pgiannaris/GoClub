'use client';

import { useEffect, useState } from 'react';

import { toast } from 'sonner';

type EventItem = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
};

type RsvpState = {
  status: 'going' | 'maybe' | 'not_going' | null;
  stats: {
    going: number;
    maybe: number;
    not_going: number;
    total: number;
  };
};

type Theme = {
  surface: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  text: string;
  mutedText: string;
  cardText: string;
};

const GUEST_NAME_STORAGE_KEY = 'goclub-public-rsvp-name';
const GUEST_TOKEN_STORAGE_KEY = 'goclub-public-rsvp-token';

export function PublicEventRsvpList({
  events,
  theme,
  isAuthenticated,
  defaultResponderName,
}: {
  events: EventItem[];
  theme: Theme;
  isAuthenticated: boolean;
  defaultResponderName?: string | null;
}) {
  const [guestName, setGuestName] = useState(defaultResponderName ?? '');
  const [guestToken, setGuestToken] = useState('');
  const [responses, setResponses] = useState<Record<string, RsvpState>>({});
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedName = window.localStorage.getItem(GUEST_NAME_STORAGE_KEY) || '';
    const storedToken =
      window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY) || window.crypto.randomUUID();

    if (!window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)) {
      window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, storedToken);
    }

    if (!isAuthenticated && storedName) {
      setGuestName(storedName);
    }

    setGuestToken(storedToken);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!events.length) return;

    const loadResponses = async () => {
      const entries = await Promise.all(
        events.map(async (event) => {
          const query = guestToken ? `?guestToken=${encodeURIComponent(guestToken)}` : '';
          const response = await fetch(`/api/public/events/${encodeURIComponent(event.id)}/rsvp${query}`, {
            credentials: 'include',
          });

          if (!response.ok) {
            return [event.id, null] as const;
          }

          const payload = (await response.json()) as {
            stats: RsvpState['stats'];
            currentResponse?: {
              status: RsvpState['status'];
            } | null;
          };

          return [
            event.id,
            {
              status: payload.currentResponse?.status ?? null,
              stats: payload.stats,
            },
          ] as const;
        }),
      );

      setResponses((current) => {
        const next = { ...current };

        for (const [eventId, value] of entries) {
          if (value) {
            next[eventId] = value;
          }
        }

        return next;
      });
    };

    void loadResponses();
  }, [events, guestToken, isAuthenticated]);

  const submitResponse = async (
    eventId: string,
    status: 'going' | 'maybe' | 'not_going',
  ) => {
    const responderName = isAuthenticated
      ? defaultResponderName?.trim() || guestName.trim() || 'Member'
      : guestName.trim();

    if (!isAuthenticated && !responderName) {
      toast.error('Enter your name before responding');
      return;
    }

    if (!isAuthenticated && guestName.trim()) {
      window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, guestName.trim());
    }

    setSavingEventId(eventId);

    try {
      const response = await fetch(`/api/public/events/${encodeURIComponent(eventId)}/rsvp`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status,
          responderName,
          guestToken: guestToken || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        stats?: RsvpState['stats'];
        currentResponse?: {
          status: RsvpState['status'];
        } | null;
      };

      if (!response.ok || !payload.stats) {
        throw new Error(payload.error || 'Failed to save RSVP');
      }

      setResponses((current) => ({
        ...current,
        [eventId]: {
          status: payload.currentResponse?.status ?? status,
          stats: payload.stats!,
        },
      }));

      toast.success('RSVP saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save RSVP');
    } finally {
      setSavingEventId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-heading text-2xl font-semibold" style={{ color: theme.cardText }}>
            RSVP
          </h3>
          <p className="text-sm" style={{ color: theme.mutedText }}>
            Let the club know if you are going, maybe going, or not going.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="w-full max-w-sm">
            <label
              className="mb-1 block text-xs font-medium uppercase"
              style={{ color: theme.mutedText }}
            >
              Your name
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Enter your name"
              maxLength={80}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {events.map((event) => {
          const response = responses[event.id];

          return (
            <div
              key={event.id}
              className="rounded-xl border p-4"
              style={{
                background: theme.surface,
                borderColor: theme.border,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-heading text-lg font-semibold" style={{ color: theme.cardText }}>
                    {event.title}
                  </h4>
                  <p className="text-sm" style={{ color: theme.mutedText }}>
                    {formatEventMeta(event)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <RsvpButton
                    label="Going"
                    active={response?.status === 'going'}
                    onClick={() => void submitResponse(event.id, 'going')}
                    disabled={savingEventId === event.id}
                    theme={theme}
                  />
                  <RsvpButton
                    label="Maybe"
                    active={response?.status === 'maybe'}
                    onClick={() => void submitResponse(event.id, 'maybe')}
                    disabled={savingEventId === event.id}
                    theme={theme}
                  />
                  <RsvpButton
                    label="Not Going"
                    active={response?.status === 'not_going'}
                    onClick={() => void submitResponse(event.id, 'not_going')}
                    disabled={savingEventId === event.id}
                    theme={theme}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: theme.mutedText }}>
                <StatChip label="Going" value={response?.stats.going ?? 0} theme={theme} />
                <StatChip label="Maybe" value={response?.stats.maybe ?? 0} theme={theme} />
                <StatChip label="Not Going" value={response?.stats.not_going ?? 0} theme={theme} />
                <StatChip label="Total" value={response?.stats.total ?? 0} theme={theme} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RsvpButton({
  label,
  active,
  onClick,
  disabled,
  theme,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  theme: Theme;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      style={{
        background: active ? theme.accent : theme.surface,
        borderColor: active ? theme.accent : theme.border,
        color: active ? '#ffffff' : theme.text,
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function StatChip({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: Theme;
}) {
  return (
    <span
      className="rounded-full px-2.5 py-1"
      style={{
        background: theme.accentSoft,
        color: theme.accentText,
      }}
    >
      {label}: {value}
    </span>
  );
}

function formatEventMeta(event: EventItem) {
  const date = new Date(event.start_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  return `${dateLabel}${event.location ? ` at ${event.location}` : ''}`;
}
