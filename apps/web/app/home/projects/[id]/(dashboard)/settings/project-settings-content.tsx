'use client';

import { useEffect, useState } from 'react';

import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
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

export function ProjectSettingsContent({ projectId }: { projectId: string }) {
  const supabase = useSupabase();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadProjectSettings();
  }, [projectId]);

  const loadProjectSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        console.error('Error loading project:', error);
        toast.error('Failed to load project settings');
        return;
      }

      if (data) {
        setProject(data);
        setWebhookUrl(data.webhook_url || '');
        setApiKey(data.api_key || '');
      }
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
      const { error } = await (supabase as any)
        .from('projects')
        .update({
          webhook_url: webhookUrl,
          api_key: apiKey,
        })
        .eq('id', projectId);

      if (error) {
        console.error('Update error:', error);
        toast.error('Failed to save settings');
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
    return (
      <div className="flex items-center justify-center p-8">Loading...</div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your club settings</p>
      </div>

      {/* API Settings */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Configure API keys and webhooks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              type="password"
            />
            <p className="text-muted-foreground text-xs">
              Keep this secure and never share it publicly
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              type="url"
            />
            <p className="text-muted-foreground text-xs">
              URL where project events will be sent
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* General Settings (Renamed from Environment) */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Club details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Status</p>
              <p className="text-muted-foreground text-sm capitalize">
                {project.status || 'active'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
