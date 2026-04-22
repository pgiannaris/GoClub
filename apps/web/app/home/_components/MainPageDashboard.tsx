'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

export default function MainPageDashboard() {
  const supabase = useSupabase();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyStateReady, setEmptyStateReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);

  // Fetch projects for the current user
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;

      if (!userId) return;
      setCurrentUserId(userId);

      const [
        { data: ownedProjects, error: ownedProjectsError },
        { data: memberships, error: membershipsError },
        { data: inviteRows, error: invitesError },
      ] = await Promise.all([
        (supabase as any)
          .from('projects')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('project_members')
          .select('project_id')
          .eq('account_id', userId),
        (supabase as any)
          .from('project_invitations')
          .select('id, project_id, invited_email, role, status, created_at')
          .eq('invited_account_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (ownedProjectsError || membershipsError || invitesError) {
        console.error('Error fetching dashboard data:', {
          ownedProjectsError,
          membershipsError,
          invitesError,
        });
        toast.error('Failed to load projects');
        return;
      }

      const memberProjectIds = Array.from(
        new Set(
          ((memberships ?? []) as Array<{ project_id: string }>)
            .map((membership) => membership.project_id)
            .filter(Boolean),
        ),
      ).filter(
        (projectId) =>
          !(ownedProjects ?? []).some(
            (project: any) => project.id === projectId,
          ),
      );

      const memberProjectsResponse = memberProjectIds.length
        ? await (supabase as any)
            .from('projects')
            .select('*')
            .in('id', memberProjectIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

      if (memberProjectsResponse.error) {
        console.error(
          'Error fetching collaborator projects:',
          memberProjectsResponse.error,
        );
        toast.error('Failed to load projects');
        return;
      }

      const inviteProjectIds = Array.from(
        new Set(
          ((inviteRows ?? []) as Array<{ project_id: string }>).map(
            (invite) => invite.project_id,
          ),
        ),
      );

      const inviteProjectsResponse = inviteProjectIds.length
        ? await (supabase as any)
            .from('projects')
            .select('id, name, description')
            .in('id', inviteProjectIds)
        : { data: [], error: null };

      if (inviteProjectsResponse.error) {
        console.error(
          'Error fetching invitation projects:',
          inviteProjectsResponse.error,
        );
        toast.error('Failed to load invitations');
        return;
      }

      const inviteProjectById = new Map(
        ((inviteProjectsResponse.data ?? []) as any[]).map((project) => [
          project.id,
          project,
        ]),
      );

      const combinedProjects = [
        ...((ownedProjects ?? []) as any[]),
        ...((memberProjectsResponse.data ?? []) as any[]),
      ];

      setProjects(
        combinedProjects.filter(
          (project, index, array) =>
            array.findIndex((item) => item.id === project.id) === index,
        ),
      );
      setPendingInvites(
        ((inviteRows ?? []) as any[]).map((invite) => ({
          ...invite,
          project: inviteProjectById.get(invite.project_id) ?? null,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (loading || projects.length > 0) {
      setEmptyStateReady(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEmptyStateReady(true);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [loading, projects.length]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) return projects;

    return projects.filter((project) => {
      const searchable = [
        project.name,
        project.description,
        project.status,
        project.plan_type,
        project.provider,
        project.region,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [projects, normalizedQuery]);

  const formatStatus = (status?: string | null) => {
    if (!status) return 'Unknown';

    return status
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const statusBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'active':
        return 'border-transparent bg-green-50 text-green-700';
      case 'off':
      case 'paused':
      case 'archived':
        return 'border-transparent bg-red-50 text-red-700';
      case 'deploying':
      case 'coming_up':
      case 'restoring':
        return 'border-slate-200 bg-white text-slate-900';
      default:
        return 'border-border text-foreground';
    }
  };

  const onCreateProject = async () => {
    if (!name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;

      console.log('Auth check:', { userRes, userId });

      if (!userId) {
        toast.error('You must be signed in to create a project');
        console.error('No user ID found. User data:', userRes);
        return;
      }

      // Check for duplicate project name
      const { data: existingProjects } = await supabase
        // @ts-expect-error: the 'onclick' attribute is required here
        .from('projects')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .limit(1);

      if (existingProjects && existingProjects.length > 0) {
        toast.error('A project with this name already exists');
        return;
      }

      // Insert new project
      const { data, error } = await supabase
        // @ts-expect-error: the 'onclick' attribute is required here
        .from('projects')
        .insert({ name, description, owner_id: userId })
        .select()
        .single();

      if (error) {
        console.error('Create project error:', error);
        toast.error('Failed to create project');
        return;
      }

      toast.success(`Project "${data.name}" created`);
      setName('');
      setDescription('');
      setOpen(false);

      // Refresh projects list
      fetchProjects();
    } finally {
      setSubmitting(false);
    }
  };

  const respondToInvite = async (
    invitationId: string,
    action: 'accept' | 'dismiss',
  ) => {
    setActingInviteId(invitationId);

    try {
      const response = await fetch(
        `/api/project-invitations/${encodeURIComponent(invitationId)}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to ${action} invitation`);
      }

      toast.success(
        action === 'accept' ? 'Invitation accepted' : 'Invitation dismissed',
      );
      await fetchProjects();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${action} invitation`,
      );
    } finally {
      setActingInviteId(null);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-8">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">My Clubs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage your clubs
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="group h-10 cursor-pointer gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow-md">
              <Plus className="r h-4 w-4" />
              <span>New club</span>
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new club</DialogTitle>
              <DialogDescription>
                Name your club and choose where to run it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="project-name">Club name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. GoClub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  placeholder="Optional description of your club"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={onCreateProject} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create club'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & filters */}
      <div className="mb-6 flex items-center gap-3 px-10">
        <div className="bg-muted flex w-80 items-center gap-2 rounded-md border px-3 py-2">
          <input
            placeholder="Search for a club"
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <button className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md border px-3 py-2 text-sm">
          Filter
        </button>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mb-6 px-10">
          <div className="bg-card rounded-xl border p-5">
            <div className="mb-4">
              <h2 className="text-foreground text-lg font-semibold">
                Pending invitations
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Accept a club invitation to add it to your dashboard, or dismiss
                it.
              </p>
            </div>

            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {invite.project?.name || 'Club invitation'}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {invite.project?.description || invite.invited_email}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Role: {invite.role}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={actingInviteId === invite.id}
                      onClick={() => void respondToInvite(invite.id, 'dismiss')}
                    >
                      Dismiss
                    </Button>
                    <Button
                      disabled={actingInviteId === invite.id}
                      onClick={() => void respondToInvite(invite.id, 'accept')}
                    >
                      {actingInviteId === invite.id ? 'Working...' : 'Accept'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Projects grid */}
      <div className="grid grid-cols-1 gap-6 px-10 pb-10 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex min-h-[260px] items-center justify-center">
            <div className="bg-card flex min-h-[180px] w-full max-w-md flex-col items-center justify-center gap-3 rounded-xl border p-6">
              <Spinner className="h-6 w-6" />
              <p className="text-muted-foreground text-sm font-medium">
                Loading...
              </p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          emptyStateReady ? (
            <p className="font-semibold">No clubs yet</p>
          ) : (
            <div className="col-span-full flex min-h-[260px] items-center justify-center">
              <div className="bg-card flex min-h-[180px] w-full max-w-md flex-col items-center justify-center gap-3 rounded-xl border p-6">
                <Spinner className="h-6 w-6" />
                <p className="text-muted-foreground text-sm font-medium">
                  Checking clubs...
                </p>
              </div>
            </div>
          )
        ) : filteredProjects.length === 0 ? (
          <p className="text-muted-foreground">
            No clubs match "{searchQuery.trim()}"
          </p>
        ) : (
          filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/home/projects/${project.id}`}
              className="block"
            >
              <div className="bg-card hover:border-primary cursor-pointer rounded-xl border p-5 transition">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-foreground font-medium">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {project.owner_id === currentUserId
                        ? 'Owner'
                        : 'Collaborator'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(statusBadgeClass(project.status))}
                    >
                      {formatStatus(project.status)}
                    </Badge>
                  </div>
                </div>

                {project.description && (
                  <p className="text-muted-foreground mb-4 text-sm">
                    {project.description}
                  </p>
                )}
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {project.plan_type && (
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Plan:
                      </span>{' '}
                      {project.plan_type}
                    </span>
                  )}
                  {project.provider && (
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Provider:
                      </span>{' '}
                      {project.provider}
                    </span>
                  )}
                  {project.region && (
                    <span>
                      <span className="text-foreground/70 font-medium">
                        Region:
                      </span>{' '}
                      {project.region}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
