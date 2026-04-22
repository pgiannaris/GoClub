'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';

export function ProjectBreadcrumbs() {
  const params = useParams();
  const projectId = params.id as string | undefined;
  const supabase = useSupabase();

  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let isActive = true;

    const loadProjectName = async () => {
      const { data, error } = await supabase
        // @ts-expect-error: the 'onclick' attribute is required here
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      if (error) {
        console.error('Error loading project name:', error);
        return;
      }

      if (isActive) {
        setProjectName(data?.name ?? null);
      }
    };

    loadProjectName();

    return () => {
      isActive = false;
    };
  }, [projectId, supabase]);

  const values = useMemo(() => {
    if (!projectId || !projectName) return undefined;
    return { [projectId]: projectName };
  }, [projectId, projectName]);

  return <AppBreadcrumbs values={values} />;
}
