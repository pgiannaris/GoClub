'use client';

import { useEffect, useRef } from 'react';

import { useRouter } from 'next/navigation';

import { useTheme } from 'next-themes';

const COOKIE_NAME = 'resolved-theme';

export function PublicSiteThemeSync() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const previousTheme = useRef<string | null>(null);

  useEffect(() => {
    if (!resolvedTheme) {
      return;
    }

    const currentCookie = getCookie(COOKIE_NAME);
    document.cookie = `${COOKIE_NAME}=${resolvedTheme}; path=/; max-age=31536000`;

    if (previousTheme.current === null) {
      previousTheme.current = resolvedTheme;

      if (currentCookie !== resolvedTheme) {
        router.refresh();
      }

      return;
    }

    if (previousTheme.current !== resolvedTheme || currentCookie !== resolvedTheme) {
      previousTheme.current = resolvedTheme;
      router.refresh();
    }
  }, [resolvedTheme, router]);

  return null;
}

function getCookie(name: string) {
  const parts = document.cookie.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
