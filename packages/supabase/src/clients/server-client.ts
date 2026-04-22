import 'server-only';

import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { getSupabaseCookieOptions } from '../cookie-options';
import { Database } from '../database.types';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * @name getSupabaseServerClient
 * @description Creates a Supabase client for use in the Server.
 */
export function getSupabaseServerClient<GenericSchema = Database>(
  hostname?: string,
) {
  const keys = getSupabaseClientKeys();

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookieOptions: getSupabaseCookieOptions(hostname),
    cookies: {
      async getAll() {
        const cookieStore = await cookies();

        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        const cookieStore = await cookies();

        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
