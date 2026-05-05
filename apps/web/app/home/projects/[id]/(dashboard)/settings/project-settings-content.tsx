'use client';

import { useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { AccountDangerZone } from '@kit/accounts/components';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

type ProjectSettingsPayload = {
  name: string;
  description: string;
  status: 'active' | 'paused' | 'archived' | 'coming_up' | 'restoring';
};

export function ProjectSettingsContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectSettingsPayload['status']>('active');
  const [canManage, setCanManage] = useState(false);

  const focusTarget = searchParams.get('focus');

  useEffect(() => {
    void loadProjectSettings();
  }, [projectId]);

  useEffect(() => {
    if (loading || focusTarget !== 'description') return;

    const target = descriptionRef.current;
    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus();
      target.setSelectionRange(target.value.length, target.value.length);
    });
  }, [focusTarget, loading]);

  const loadProjectSettings = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/settings`, {
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        settings?: ProjectSettingsPayload;
        permissions?: {
          canManage?: boolean;
        };
      };

      if (!response.ok || !payload.settings) {
        toast.error(payload.error || 'Failed to load project settings');
        return;
      }

      setName(payload.settings.name || '');
      setDescription(payload.settings.description || '');
      setStatus(payload.settings.status || 'active');
      setCanManage(Boolean(payload.permissions?.canManage));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          status,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error || 'Failed to save settings');
        return;
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your club and account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Club Details</CardTitle>
          <CardDescription>Update how your club appears across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="club-name">Club Name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Club name"
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="club-description">Description</Label>
            <Textarea
              id="club-description"
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your club"
              rows={4}
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="club-status">Club Status</Label>
            <select
              id="club-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectSettingsPayload['status'])}
              disabled={!canManage}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-2xs outline-none"
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
              <option value="coming_up">coming_up</option>
              <option value="restoring">restoring</option>
            </select>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving || !canManage}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Account Deletion</CardTitle>
          <CardDescription>Permanently delete your account and related access.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountDangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
