'use client';

import React from 'react';

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  start_at?: string;
  location?: string | null;
  rsvp_url?: string | null;
};

type Theme = {
  surface?: string;
  border?: string;
  accent?: string;
  accentSoft?: string;
  accentText?: string;
  text?: string;
  mutedText?: string;
  cardText?: string;
};

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
  return (
    <section className="space-y-4">
      <div
        className="rounded-md border p-4"
        style={{ background: theme?.surface, borderColor: theme?.border }}
      >
        {events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <h4
                    className="font-semibold"
                    style={{ color: theme?.cardText }}
                  >
                    {event.title}
                  </h4>
                  {event.rsvp_url ? (
                    <a
                      className="text-sm text-blue-600"
                      href={event.rsvp_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      RSVP
                    </a>
                  ) : null}
                </div>
                {event.description ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {event.description}
                  </p>
                ) : null}
                <div
                  className="mt-2 text-xs"
                  style={{ color: theme?.mutedText }}
                >
                  {event.location ?? 'TBA'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">No public events.</div>
        )}
      </div>
    </section>
  );
}
