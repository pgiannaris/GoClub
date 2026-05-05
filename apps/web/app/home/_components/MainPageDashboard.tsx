'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  Settings,
  SquareCheckBig,
  Trash2,
  Users,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';

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
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [collaboratorOnly, setCollaboratorOnly] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [confirmName, setConfirmName] = useState('');

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
      const dedupedProjects = combinedProjects.filter(
        (project, index, array) =>
          array.findIndex((item) => item.id === project.id) === index,
      );
      setProjects(dedupedProjects);
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

  // Reset the typed confirmation when the dialog opens/closes or target changes
  useEffect(() => {
    setConfirmName('');
  }, [projectToDelete]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    let result = projects.slice();

    if (ownedOnly && currentUserId) {
      result = result.filter((p) => p.owner_id === currentUserId);
    }

    if (collaboratorOnly && currentUserId) {
      result = result.filter((p) => p.owner_id !== currentUserId);
    }

    if (!normalizedQuery) return result;

    return result.filter((project) => {
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
  }, [projects, normalizedQuery, ownedOnly, collaboratorOnly, currentUserId]);

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
        return ' text-green-700';
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

  const confirmDeleteProject = async () => {
    if (!projectToDelete) {
      return;
    }

    if (confirmName !== projectToDelete.name) {
      toast.error('Please type the club name to confirm deletion');
      return;
    }

    setDeletingProjectId(projectToDelete.id);

    try {
      const { error } = await (supabase as any)
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);

      if (error) {
        console.error('Delete project error:', error);
        toast.error('Failed to delete club');
        return;
      }

      toast.success('Club deleted');
      setProjects((current) =>
        current.filter((project) => project.id !== projectToDelete.id),
      );
      setProjectToDelete(null);
      setConfirmName('');
    } catch (error) {
      console.error('Delete project error:', error);
      toast.error('Failed to delete club');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const getShareUrl = (project: any) => {
    try {
      const origin = window.location?.origin ?? '';
      return `${origin}/home/projects/${project.id}`;
    } catch (e) {
      return `/home/projects/${project.id}`;
    }
  };

  const copyShareLink = async (project: any) => {
    const url = getShareUrl(project);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const nativeShare = async (project: any) => {
    const url = getShareUrl(project);
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: project.name,
          text: project.description || project.name,
          url,
        });
      } catch (err) {
        // user canceled or failed
      }
    } else {
      toast('Sharing not supported on this device');
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:bg-muted inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">
              Filter
              <ChevronDown className="ml-2 h-4 w-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuCheckboxItem
              checked={ownedOnly}
              onSelect={(e) => {
                e.preventDefault?.();
                setOwnedOnly((v) => !v);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="bg-background text-foreground border-foreground/40 flex h-4 w-4 items-center justify-center rounded-sm border-2">
                  {ownedOnly ? (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span>Owned</span>
              </span>
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={collaboratorOnly}
              onSelect={(e) => {
                e.preventDefault?.();
                setCollaboratorOnly((v) => !v);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="bg-background text-foreground border-foreground/40 flex h-4 w-4 items-center justify-center rounded-sm border-2">
                  {collaboratorOnly ? (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span>Collaborator</span>
              </span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <div className="grid grid-cols-1 items-start gap-6 px-10 pb-10 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex min-h-[260px] items-center justify-center">
            <DashboardLogoLoader label="Loading clubs..." />
          </div>
        ) : projects.length === 0 ? (
          emptyStateReady ? (
            <p className="font-semibold">No clubs yet</p>
          ) : (
            <div className="col-span-full flex min-h-[260px] items-center justify-center">
              <DashboardLogoLoader label="Checking clubs..." />
            </div>
          )
        ) : filteredProjects.length === 0 ? (
          <p className="text-muted-foreground">No clubs match</p>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group bg-card hover:border-primary relative min-h-64 overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-sm"
            >
              <div className="absolute top-6 right-6 z-20 flex shrink-0 items-center gap-2">
                {/* Delete moved into the actions menu */}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Open actions for ${project.name}`}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground bg-background/90 inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/home/projects/${project.id}/settings`}
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Club settings</span>
                      </Link>
                    </DropdownMenuItem>

                    {project.owner_id === currentUserId ? (
                      <DropdownMenuItem asChild>
                        <button
                          type="button"
                          className="text-destructive flex w-full items-center gap-2"
                          onClick={() => setProjectToDelete(project)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete club</span>
                        </button>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link
                href={`/home/projects/${project.id}`}
                className="flex h-full flex-col p-6 pr-20"
                aria-label={`Open ${project.name}`}
              >
                <div className="mb-5 min-w-0 flex-1">
                  <h3 className="text-foreground mb-2 line-clamp-2 pr-2 text-2xl leading-tight font-semibold">
                    {project.name}
                  </h3>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        project.owner_id === currentUserId
                          ? 'text-blue-500'
                          : 'text-white'
                      }
                    >
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

                <p className="text-muted-foreground line-clamp-3 min-h-[60px] text-sm leading-6">
                  {project.description?.trim() ||
                    'No description yet. Add a short summary so collaborators can tell what this club is for at a glance.'}
                </p>

                <div className="text-muted-foreground mt-5 flex flex-wrap gap-2 text-xs">
                  {project.plan_type ? (
                    <span className="rounded-md border px-2 py-1">
                      {project.plan_type}
                    </span>
                  ) : null}
                  {project.provider ? (
                    <span className="rounded-md border px-2 py-1">
                      {project.provider}
                    </span>
                  ) : null}
                  {project.region ? (
                    <span className="rounded-md border px-2 py-1">
                      {project.region}
                    </span>
                  ) : null}
                  <span className="rounded-md border px-2 py-1">
                    Created {formatDateLabel(project.created_at)}
                  </span>
                </div>
              </Link>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={Boolean(projectToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletingProjectId) {
            setProjectToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete club?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">
                {projectToDelete?.name ?? 'this club'}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type the club name to confirm
              </Label>
              <Input
                id="confirm-name"
                placeholder={projectToDelete?.name ?? ''}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              disabled={Boolean(deletingProjectId)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteProject()}
              disabled={
                Boolean(deletingProjectId) ||
                confirmName !== projectToDelete?.name
              }
            >
              {deletingProjectId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function DashboardLogoLoader({ label }: { label: string }) {
  return (
    <div className="col-span-full flex min-h-[220px] items-center justify-center">
      <div className="bg-card flex w-full max-w-md flex-col items-center justify-center rounded-xl border px-6 py-8">
        <Spinner />
        <p className="text-muted-foreground mt-5 text-sm font-medium">
          {label}
        </p>
      </div>
    </div>
  );
}
