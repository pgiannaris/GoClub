import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getRequestAccessToken } from '~/lib/auth/get-request-access-token';

type PublicEventRouteContext = {
  params: Promise<{ eventId: string }>;
};

type RsvpStatus = 'going' | 'maybe' | 'not_going';

export async function GET(request: Request, context: PublicEventRouteContext) {
  const { eventId } = await context.params;
  const guestToken = new URL(request.url).searchParams.get('guestToken')?.trim() || null;
  const preparation = await preparePublicEventRsvp(eventId, request);

  if ('response' in preparation) {
    return preparation.response;
  }

  const { adminClient, user } = preparation;
  const stats = await getEventRsvpStats(adminClient, eventId);
  const currentResponse = await getCurrentResponse(adminClient, eventId, user?.id ?? null, guestToken);

  return NextResponse.json(
    {
      stats,
      currentResponse,
    },
    { status: 200 },
  );
}

export async function POST(request: Request, context: PublicEventRouteContext) {
  const { eventId } = await context.params;
  const preparation = await preparePublicEventRsvp(eventId, request);

  if ('response' in preparation) {
    return preparation.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parsePublicRsvpBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Valid RSVP data is required' }, { status: 400 });
  }

  const { adminClient, event, user } = preparation;
  const identity = await resolveResponderIdentity(adminClient, user?.id ?? null, parsed);

  if (!identity) {
    return NextResponse.json({ error: 'Name is required for public RSVPs' }, { status: 400 });
  }

  const existingResponse = await getCurrentResponse(
    adminClient,
    eventId,
    identity.accountId,
    identity.guestToken,
  );

  if (existingResponse) {
    const { error } = await updateEventRsvp(adminClient, existingResponse.id, identity.responderName, parsed.status);

    if (error) {
      console.error('Failed to update event RSVP', { eventId, error });
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 });
    }
  } else {
    const { error } = await (adminClient as any).from('event_rsvps').insert({
      project_id: event.project_id,
      event_id: event.id,
      account_id: identity.accountId,
      guest_token: identity.guestToken,
      responder_name: identity.responderName,
      status: parsed.status,
    });

    if (error) {
      if (isEventRsvpIdentityConflict(error)) {
        const conflictingResponse = await getCurrentResponse(
          adminClient,
          eventId,
          identity.accountId,
          identity.guestToken,
        );

        if (conflictingResponse) {
          const { error: updateError } = await updateEventRsvp(
            adminClient,
            conflictingResponse.id,
            identity.responderName,
            parsed.status,
          );

          if (!updateError) {
            const stats = await getEventRsvpStats(adminClient, eventId);
            const currentResponse = await getCurrentResponse(
              adminClient,
              eventId,
              identity.accountId,
              identity.guestToken,
            );

            return NextResponse.json(
              {
                stats,
                currentResponse,
              },
              { status: 200 },
            );
          }

          console.error('Failed to resolve conflicting event RSVP', {
            eventId,
            conflictError: error,
            updateError,
          });
          return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 });
        }
      }

      console.error('Failed to create event RSVP', { eventId, error });
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 });
    }
  }

  const stats = await getEventRsvpStats(adminClient, eventId);
  const currentResponse = await getCurrentResponse(
    adminClient,
    eventId,
    identity.accountId,
    identity.guestToken,
  );

  return NextResponse.json(
    {
      stats,
      currentResponse,
    },
    { status: 200 },
  );
}

async function preparePublicEventRsvp(eventId: string, request: Request) {
  const adminClient = getSupabaseServerAdminClient();
  const accessToken = getRequestAccessToken(request);
  const {
    data: { user },
  } = accessToken ? await adminClient.auth.getUser(accessToken) : { data: { user: null } };

  const { data: event, error } = await (adminClient as any)
    .from('events')
    .select('id, project_id, visibility')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) {
    return {
      response: NextResponse.json({ error: 'Event not found' }, { status: 404 }),
    };
  }

  if (event.visibility !== 'public') {
    return {
      response: NextResponse.json({ error: 'This event is not public' }, { status: 403 }),
    };
  }

  return { adminClient, event, user };
}

function parsePublicRsvpBody(body: unknown): {
  status: RsvpStatus;
  responderName: string | null;
  guestToken: string | null;
} | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const rawStatus = (body as { status?: unknown }).status;
  const rawResponderName = (body as { responderName?: unknown }).responderName;
  const rawGuestToken = (body as { guestToken?: unknown }).guestToken;

  if (rawStatus !== 'going' && rawStatus !== 'maybe' && rawStatus !== 'not_going') {
    return null;
  }

  return {
    status: rawStatus,
    responderName:
      typeof rawResponderName === 'string' ? rawResponderName.trim().slice(0, 80) || null : null,
    guestToken:
      typeof rawGuestToken === 'string' ? rawGuestToken.trim().slice(0, 120) || null : null,
  };
}

async function resolveResponderIdentity(
  adminClient: any,
  userId: string | null,
  payload: { responderName: string | null; guestToken: string | null },
) {
  if (userId) {
    const { data: account } = await (adminClient as any)
      .from('accounts')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    if (!account) {
      return {
        accountId: null,
        guestToken: `auth:${userId}`,
        responderName: payload.responderName || 'Member',
      };
    }

    return {
      accountId: userId,
      guestToken: null,
      responderName: account?.name?.trim() || payload.responderName || 'Member',
    };
  }

  if (!payload.responderName || !payload.guestToken) {
    return null;
  }

  return {
    accountId: null,
    guestToken: payload.guestToken,
    responderName: payload.responderName,
  };
}

async function getCurrentResponse(
  adminClient: any,
  eventId: string,
  accountId: string | null,
  guestToken: string | null,
) {
  if (!accountId && !guestToken) {
    return null;
  }

  let query = (adminClient as any)
    .from('event_rsvps')
    .select('id, status, responder_name, updated_at, created_at')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  query = accountId ? query.eq('account_id', accountId) : query.eq('guest_token', guestToken);

  const { data, error } = await query;

  if (error) {
    console.error('Failed to look up current event RSVP', {
      eventId,
      accountId,
      guestToken,
      error,
    });

    return null;
  }

  return data?.[0]
    ? {
        id: data[0].id,
        status: data[0].status,
        responder_name: data[0].responder_name,
      }
    : null;
}

async function updateEventRsvp(
  adminClient: any,
  rsvpId: string,
  responderName: string,
  status: RsvpStatus,
) {
  return (adminClient as any)
    .from('event_rsvps')
    .update({
      responder_name: responderName,
      status,
    })
    .eq('id', rsvpId);
}

function isEventRsvpIdentityConflict(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) {
    return false;
  }

  if (error.code === '23505') {
    return true;
  }

  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('uniq_event_rsvps_account') || message.includes('uniq_event_rsvps_guest');
}

async function getEventRsvpStats(
  adminClient: any,
  eventId: string,
) {
  const { data } = await (adminClient as any)
    .from('event_rsvps')
    .select('status')
    .eq('event_id', eventId);

  const stats = {
    going: 0,
    maybe: 0,
    not_going: 0,
    total: 0,
  };

  for (const row of data ?? []) {
    if (row.status === 'going') stats.going += 1;
    if (row.status === 'maybe') stats.maybe += 1;
    if (row.status === 'not_going') stats.not_going += 1;
    stats.total += 1;
  }

  return stats;
}
