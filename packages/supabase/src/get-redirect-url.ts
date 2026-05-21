export function getRedirectURL(path = '') {
  const origin = getBaseOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return new URL(normalizedPath, origin).toString();
}

function getBaseOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    return siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  }

  return 'https://go-club-web.vercel.app/';
}
