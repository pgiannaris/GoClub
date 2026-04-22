import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function usePersonalAccountData(
  userId: string,
  partialAccount?: {
    id: string | null;
    name: string | null;
    avatar_url: string | null;
  },
) {
  const client = useSupabase();
  const queryKey = ['account:data', userId];

  const queryFn = async () => {
    if (!userId) {
      return null;
    }

    const response = await client
      .from('accounts')
      .select(
        `
        id,
        name,
        avatar_url
    `,
      )
      .eq('id', userId)
      .single();

    if (response.error) {
      throw response.error;
    }

    return response.data;
  };

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!userId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    initialData: partialAccount?.id
      ? {
          id: partialAccount.id,
          name: partialAccount.name,
          avatar_url: partialAccount.avatar_url,
        }
      : undefined,
  });
}

export function useRevalidatePersonalAccountDataQuery() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) =>
      queryClient.invalidateQueries({
        queryKey: ['account:data', userId],
      }),
    [queryClient],
  );
}
