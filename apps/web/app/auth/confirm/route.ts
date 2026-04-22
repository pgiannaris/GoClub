import { NextRequest, NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getAuthHomePath } from '~/lib/auth/get-auth-home-path';

export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(
    getSupabaseServerClient(request.nextUrl.hostname),
  );

  const url = await service.verifyTokenHash(request, {
    redirectPath: getAuthHomePath(request.nextUrl.hostname),
  });

  return NextResponse.redirect(url);
}
