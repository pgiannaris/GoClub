'use client';

import { useParams } from 'next/navigation';

import { ProjectSettingsContent } from './project-settings-content';

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <ProjectSettingsContent projectId={projectId} />;
}
