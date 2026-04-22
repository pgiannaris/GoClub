import pathsConfig from '~/config/paths.config';

const AUTH_COOKIE_DOMAIN_ENV_KEYS = [
  'AUTH_COOKIE_DOMAIN',
  'NEXT_PUBLIC_AUTH_COOKIE_DOMAIN',
] as const;

export function getAuthHomePath(hostname?: string) {
  const normalizedHostname = normalizeHostname(hostname);
  const siteHostname = normalizeHostname(process.env.NEXT_PUBLIC_SITE_URL);
  const authCookieDomain = getAuthCookieDomain();

  if (!normalizedHostname || !siteHostname) {
    return pathsConfig.app.home;
  }

  if (normalizedHostname === siteHostname) {
    return pathsConfig.app.home;
  }

  if (
    authCookieDomain &&
    normalizedHostname !== authCookieDomain &&
    normalizedHostname.endsWith(`.${authCookieDomain}`)
  ) {
    return '/';
  }

  if (normalizedHostname.endsWith(`.${siteHostname}`)) {
    return '/';
  }

  return pathsConfig.app.home;
}

export function getRequestHostname(headers: Headers) {
  return (
    normalizeHostname(headers.get('x-forwarded-host')) ??
    normalizeHostname(headers.get('host'))
  );
}

function getAuthCookieDomain() {
  for (const key of AUTH_COOKIE_DOMAIN_ENV_KEYS) {
    const value = normalizeHostname(process.env[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeHostname(value?: string | null) {
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
