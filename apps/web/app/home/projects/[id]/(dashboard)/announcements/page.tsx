'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import { ChevronDown, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';

import {
  DashboardEmptyState,
  DashboardLoadingList,
  DashboardPageHeader,
} from '../_components/dashboard-page-primitives';

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: string;
  is_pinned: boolean | null;
  published_at: string | null;
  created_at: string | null;
};

type AnnouncementForm = {
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  isPinned: boolean;
};

const EMPTY_FORM: AnnouncementForm = {
  title: '',
  body: '',
  status: 'draft',
  isPinned: false,
};

export default function AnnouncementsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const supabase = useSupabase();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>(
    {},
  );
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = announcements.slice();

    const activeStatuses = Object.entries(statusFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeStatuses.length > 0) {
      result = result.filter((a) => activeStatuses.includes(a.status));
    }

    if (pinnedOnly) {
      result = result.filter((a) => Boolean(a.is_pinned));
    }

    if (!q) return result;
    return result.filter((a) => a.title.toLowerCase().includes(q));
  }, [announcements, searchQuery, statusFilters, pinnedOnly]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveTarget, setSaveTarget] = useState<'draft' | 'published' | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const loadAnnouncements = async () => {
      setLoading(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('announcements')
        .select('id, title, body, status, is_pinned, published_at, created_at')
        .eq('project_id', projectId)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load announcements');
        console.error(error);
      } else {
        setAnnouncements((data ?? []) as Announcement[]);
      }

      setLoading(false);
    };

    void loadAnnouncements();
  }, [projectId, supabase]);

  const openCreateModal = () => {
    setSelectedAnnouncement(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setForm({
      title: announcement.title,
      body: announcement.body,
      status: normalizeStatus(announcement.status),
      isPinned: Boolean(announcement.is_pinned),
    });
    setEditorOpen(true);
  };

  const saveAnnouncement = async (nextStatus: 'draft' | 'published') => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }

    const title = form.title.trim();
    const body = form.body.trim();

    if (!title) {
      toast.error('Enter an announcement title');
      return;
    }

    if (!body) {
      toast.error('Enter announcement details');
      return;
    }

    setSaveTarget(nextStatus);
    setSaving(true);

    try {
      const payload = {
        title,
        body,
        status: nextStatus,
        is_pinned: form.isPinned,
        published_at:
          nextStatus === 'published'
            ? (selectedAnnouncement?.published_at ?? new Date().toISOString())
            : null,
      };

      if (selectedAnnouncement) {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/announcements/${encodeURIComponent(selectedAnnouncement.id)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        );

        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          announcement?: Announcement;
        };

        if (!response.ok || !result.announcement) {
          throw new Error(result.error || 'Failed to update announcement');
        }

        setAnnouncements((prev) =>
          upsertAnnouncement(prev, result.announcement as Announcement),
        );
        setSelectedAnnouncement(result.announcement as Announcement);
        toast.success(
          nextStatus === 'published' ? 'Announcement published' : 'Draft saved',
        );
      } else {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/announcements`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        );

        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          announcement?: Announcement;
        };

        if (!response.ok || !result.announcement) {
          throw new Error(result.error || 'Failed to create announcement');
        }

        setAnnouncements((prev) =>
          upsertAnnouncement(prev, result.announcement as Announcement),
        );
        toast.success(
          nextStatus === 'published' ? 'Announcement published' : 'Draft saved',
        );
      }

      setEditorOpen(false);
      setSelectedAnnouncement(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : selectedAnnouncement
            ? 'Failed to update announcement'
            : 'Failed to create announcement';
      toast.error(message);
    } finally {
      setSaveTarget(null);
      setSaving(false);
    }
  };

  const deleteAnnouncement = async () => {
    if (!projectId || !selectedAnnouncement) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/announcements/${encodeURIComponent(selectedAnnouncement.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete announcement');
      }

      setAnnouncements((prev) =>
        prev.filter((item) => item.id !== selectedAnnouncement.id),
      );
      setEditorOpen(false);
      setSelectedAnnouncement(null);
      setForm(EMPTY_FORM);
      setDeleteModalOpen(false);
      toast.success('Announcement deleted');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to delete announcement',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Announcements"
        description="Manage club updates that can appear on the public site."
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search announcements"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Filter
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {['draft', 'published', 'archived'].map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={Boolean(statusFilters[s])}
                    onSelect={(e) => {
                      e.preventDefault?.();
                      setStatusFilters((p) => ({ ...p, [s]: !p[s] }));
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                        {statusFilters[s] ? (
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
                      <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Pinned</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={pinnedOnly}
                  onSelect={(e) => {
                    e.preventDefault?.();
                    setPinnedOnly((v) => !v);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                      {pinnedOnly ? (
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
                    <span>Show pinned only</span>
                  </span>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" onClick={openCreateModal}>
              + New Announcement
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {loading ? (
          <DashboardLoadingList keyPrefix="announcement-loading" />
        ) : null}

        {!loading && filteredAnnouncements.length === 0 && (
          <DashboardEmptyState message="No announcements yet. Create one to start posting club updates." />
        )}

        {!loading &&
          filteredAnnouncements.map((announcement) => (
            <div key={announcement.id} className="w-full rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{announcement.title}</p>
                    <Badge variant="outline">
                      {announcement.status || 'draft'}
                    </Badge>
                    {announcement.is_pinned ? <Badge>Pinned</Badge> : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {announcement.body}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatAnnouncementDate(
                      announcement.published_at || announcement.created_at,
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(announcement)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setDeleteModalOpen(true);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setSelectedAnnouncement(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            </DialogTitle>
            <DialogDescription>
              Write the update, then save it as a draft or publish it to the
              public site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="announcement-title"
                className="text-muted-foreground text-xs"
              >
                Title
              </label>
              <Input
                id="announcement-title"
                value={form.title}
                maxLength={120}
                placeholder="Weekly club update"
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="announcement-body"
                className="text-muted-foreground text-xs"
              >
                Announcement
              </label>
              <Textarea
                id="announcement-body"
                rows={7}
                maxLength={3000}
                placeholder="Share meeting updates, reminders, or important notices..."
                value={form.body}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    body: event.target.value,
                  }))
                }
              />
              <div className="text-muted-foreground text-right text-xs">
                {form.body.length}/3000
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={form.isPinned}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isPinned: Boolean(checked),
                  }))
                }
              />
              <span>Pin announcement to the top</span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Current status:{' '}
                {selectedAnnouncement
                  ? normalizeStatus(selectedAnnouncement.status)
                  : 'draft'}
              </p>

              <div className="flex gap-2">
                {selectedAnnouncement ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteModalOpen(true)}
                    disabled={saving || deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void saveAnnouncement('draft')}
                  disabled={saving || deleting}
                >
                  {saving && saveTarget === 'draft'
                    ? 'Saving...'
                    : 'Save Draft'}
                </Button>

                <Button
                  type="button"
                  onClick={() => void saveAnnouncement('published')}
                  disabled={saving || deleting}
                >
                  {saving && saveTarget === 'published'
                    ? 'Publishing...'
                    : 'Publish'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setSelectedAnnouncement(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete announcement?</DialogTitle>
            <DialogDescription>
              {selectedAnnouncement
                ? `This will permanently delete "${selectedAnnouncement.title}".`
                : 'This will permanently delete this announcement.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteAnnouncement()}
              disabled={!selectedAnnouncement || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Announcement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeStatus(value: string): AnnouncementForm['status'] {
  if (value === 'published' || value === 'archived') return value;
  return 'draft';
}

function formatAnnouncementDate(value: string | null) {
  if (!value) return 'Date unavailable';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function upsertAnnouncement(
  current: Announcement[],
  nextAnnouncement: Announcement,
) {
  const next = [...current];
  const index = next.findIndex((item) => item.id === nextAnnouncement.id);

  if (index < 0) {
    next.unshift(nextAnnouncement);
  } else {
    next[index] = nextAnnouncement;
  }

  return next.sort(sortAnnouncements);
}

function sortAnnouncements(a: Announcement, b: Announcement) {
  return (
    Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
    compareDateDesc(a.published_at, b.published_at) ||
    compareDateDesc(a.created_at, b.created_at)
  );
}

function compareDateDesc(a: string | null, b: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
}
