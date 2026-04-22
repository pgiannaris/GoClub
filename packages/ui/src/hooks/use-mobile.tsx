import * as React from 'react';

const MOBILE_BREAKPOINT = 1024;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  const handleChange = () => callback();
  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  };

  if ('addEventListener' in mediaQuery) {
    mediaQuery.addEventListener('change', handleChange);
  } else if (legacyMediaQuery.addListener) {
    legacyMediaQuery.addListener(handleChange);
  }

  window.visualViewport?.addEventListener('resize', handleChange);

  return () => {
    if ('removeEventListener' in mediaQuery) {
      mediaQuery.removeEventListener('change', handleChange);
    } else if (legacyMediaQuery.removeListener) {
      legacyMediaQuery.removeListener(handleChange);
    }

    window.visualViewport?.removeEventListener('resize', handleChange);
  };
}

function getSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );
}
