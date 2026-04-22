const SUPABASE_AUTH_COOKIE_PATTERN = /^(sb-.+-auth-token)(?:\.(\d+))?$/;

export function getRequestAccessToken(request: Request) {
  const authHeader = request.headers.get('authorization')?.trim();

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();

    if (token) {
      return token;
    }
  }

  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookieValue of parseSupabaseAuthCookieValues(cookieHeader)) {
    const accessToken = extractAccessTokenFromCookieValue(cookieValue);

    if (accessToken) {
      return accessToken;
    }
  }

  return null;
}

function parseSupabaseAuthCookieValues(cookieHeader: string) {
  const cookieValues = new Map<
    string,
    {
      baseValue?: string;
      chunks: Map<number, string>;
    }
  >();

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    const name = rawName?.trim();

    if (!name) {
      continue;
    }

    const match = name.match(SUPABASE_AUTH_COOKIE_PATTERN);

    if (!match) {
      continue;
    }

    const baseName = match[1];
    const chunkIndex = match[2] ? Number.parseInt(match[2], 10) : null;
    const value = rawValueParts.join('=').trim();
    const entry = cookieValues.get(baseName) ?? {
      chunks: new Map<number, string>(),
    };

    if (chunkIndex === null || Number.isNaN(chunkIndex)) {
      entry.baseValue = value;
    } else {
      entry.chunks.set(chunkIndex, value);
    }

    cookieValues.set(baseName, entry);
  }

  return Array.from(cookieValues.values())
    .map((entry) => {
      if (entry.baseValue) {
        return entry.baseValue;
      }

      if (!entry.chunks.size) {
        return null;
      }

      return Array.from(entry.chunks.entries())
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value)
        .join('');
    })
    .filter((value): value is string => Boolean(value));
}

function extractAccessTokenFromCookieValue(value: string) {
  if (!value) {
    return null;
  }

  let decoded = value;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  try {
    const parsed = JSON.parse(decoded);

    if (typeof parsed === 'string') {
      return parsed || null;
    }

    if (Array.isArray(parsed)) {
      const maybeAccessToken = parsed[0];

      return typeof maybeAccessToken === 'string' && maybeAccessToken
        ? maybeAccessToken
        : null;
    }

    if (parsed && typeof parsed === 'object') {
      const maybeAccessToken = (parsed as { access_token?: unknown })
        .access_token;

      return typeof maybeAccessToken === 'string' && maybeAccessToken
        ? maybeAccessToken
        : null;
    }
  } catch {
    return decoded || null;
  }

  return null;
}
