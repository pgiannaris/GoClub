'use client';

import { AppLogo } from '~/components/app-logo';

export function GoClubRouteLoader() {
  return (
    <div className="bg-background fixed inset-0 z-100 flex min-h-screen w-screen flex-col items-center justify-center px-6">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Outer faint ring */}
        <div className="border-muted absolute inset-0 rounded-full border-[10px] opacity-20" />

        {/* Main spinning ring */}
        <div className="border-primary absolute inset-0 animate-spin rounded-full border-[10px] border-t-transparent border-r-transparent [animation-duration:1.4s]" />

        {/* Inner counter-spin ring */}
        <div className="border-primary/50 absolute inset-[10px] animate-spin rounded-full border-[6px] border-b-transparent border-l-transparent [animation-direction:reverse] [animation-duration:2s]" />
      </div>
    </div>
  );
}
