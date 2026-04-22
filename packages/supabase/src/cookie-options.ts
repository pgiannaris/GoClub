const COOKIE_DOMAIN_ENV_KEYS = [
  'AUTH_COOKIE_DOMAIN',
  'NEXT_PUBLIC_AUTH_COOKIE_DOMAIN',
] as const;

export function getSupabaseCookieOptions(hostname?: string) {
  const domain = getAuthCookieDomain(hostname);

  return domain ? { domain } : {};
}

export function resolveAllowedAuthRedirectUrl(
  candidate: string | URL | null | undefined,
  requestUrl: string | URL,
) {
  if (!candidate) {
    return null;
  }

  const normalizedRequestUrl =
    requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const normalizedCandidate =
    candidate instanceof URL
      ? candidate
      : new URL(candidate, normalizedRequestUrl.origin);

  return isAllowedAuthRedirectUrl(normalizedCandidate, normalizedRequestUrl)
    ? normalizedCandidate
    : null;
}

export function isAllowedAuthRedirectUrl(candidate: URL, requestUrl: URL) {
  const candidateHostname = parseHostname(candidate.hostname);
  const requestHostname = parseHostname(requestUrl.hostname);

  if (!candidateHostname || !requestHostname) {
    return false;
  }

  if (candidate.protocol !== requestUrl.protocol) {
    return false;
  }

  if (candidateHostname === requestHostname) {
    return true;
  }

  const cookieDomain = getAuthCookieDomain(requestHostname);

  if (!cookieDomain) {
    return false;
  }

  return (
    isHostnameWithinDomain(candidateHostname, cookieDomain) &&
    isHostnameWithinDomain(requestHostname, cookieDomain)
  );
}

function getAuthCookieDomain(hostname?: string) {
  const configuredDomain = getConfiguredCookieDomain();

  if (configuredDomain) {
    return configuredDomain;
  }

  const siteHostname = getSiteHostname();

  if (!siteHostname) {
    return undefined;
  }

  const resolvedHostname = normalizeHostname(hostname ?? getBrowserHostname());

  if (!resolvedHostname) {
    return siteHostname;
  }

  return isHostnameWithinDomain(resolvedHostname, siteHostname)
    ? siteHostname
    : undefined;
}

function getConfiguredCookieDomain() {
  for (const key of COOKIE_DOMAIN_ENV_KEYS) {
    const value = normalizeHostname(process.env[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getSiteHostname() {
  try {
    return normalizeHostname(process.env.NEXT_PUBLIC_SITE_URL);
  } catch {
    return undefined;
  }
}

function getBrowserHostname() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.hostname;
}

function isHostnameWithinDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeHostname(value?: string | null) {
  const hostname = parseHostname(value);

  if (!hostname) {
    return undefined;
  }

  if (!isShareableCookieHostname(hostname)) {
    return undefined;
  }

  return hostname;
}

function parseHostname(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(
      trimmed.includes('://') ? trimmed : `https://${trimmed}`,
    ).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isShareableCookieHostname(hostname: string) {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    isIpv4Address(hostname)
  ) {
    return false;
  }

  return hostname.includes('.');
}

function isIpv4Address(value: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}
