'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import { ChevronDown, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import {
  DashboardEmptyState,
  DashboardLoadingList,
  DashboardPageHeader,
} from '../_components/dashboard-page-primitives';

type PollOption = {
  id: string;
  option_text: string;
  position: number;
  vote_count: number;
};

type PollRecord = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  allow_public_votes: boolean;
  closes_at: string | null;
  created_at: string | null;
  total_votes: number;
  poll_options: PollOption[];
};

type PollForm = {
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  allowPublicVotes: boolean;
  closesAt: string;
  options: string[];
};

const EMPTY_FORM: PollForm = {
  title: '',
  description: '',
  status: 'draft',
  allowPublicVotes: false,
  closesAt: '',
  options: ['', ''],
};

export default function PollsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [polls, setPolls] = useState<PollRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>(
    {},
  );
  const [publicVotesOnly, setPublicVotesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const filteredPolls = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = polls.slice();

    const activeStatuses = Object.entries(statusFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeStatuses.length > 0) {
      result = result.filter((p) => activeStatuses.includes(p.status));
    }

    if (publicVotesOnly) {
      result = result.filter((p) => Boolean(p.allow_public_votes));
    }

    if (!q) return result;
    return result.filter((p) => p.title.toLowerCase().includes(q));
  }, [polls, searchQuery, statusFilters, publicVotesOnly]);
  const [saving, setSaving] = useState(false);
  const [canManagePolls, setCanManagePolls] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<PollRecord | null>(null);
  const [form, setForm] = useState<PollForm>(EMPTY_FORM);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const fetchPolls = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/polls`,
          {
            credentials: 'include',
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          polls?: PollRecord[];
          permissions?: {
            canManage?: boolean;
          };
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load polls');
        }

        if (cancelled) return;

        setPolls(payload.polls ?? []);
        setCanManagePolls(Boolean(payload.permissions?.canManage));
      } catch (error) {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : 'Failed to load polls',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchPolls();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openCreateModal = () => {
    setSelectedPoll(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEditModal = (poll: PollRecord) => {
    setSelectedPoll(poll);
    setForm({
      title: poll.title,
      description: poll.description ?? '',
      status: normalizeStatus(poll.status),
      allowPublicVotes: Boolean(poll.allow_public_votes),
      closesAt: poll.closes_at
        ? toDateTimeLocalInput(new Date(poll.closes_at))
        : '',
      options:
        poll.poll_options.length > 0
          ? poll.poll_options.map((option) => option.option_text)
          : ['', ''],
    });
    setEditorOpen(true);
  };

  const savePoll = async () => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }

    const title = form.title.trim();
    const options = form.options.map((option) => option.trim()).filter(Boolean);

    if (!title) {
      toast.error('Enter a poll title');
      return;
    }

    if (options.length < 2) {
      toast.error('Add at least two poll options');
      return;
    }

    if (
      new Set(options.map((option) => option.toLowerCase())).size !==
      options.length
    ) {
      toast.error('Poll options must be unique');
      return;
    }

    const closesAt = normalizeDateTimeLocal(form.closesAt);
    if (form.closesAt && !closesAt) {
      toast.error('Closing date is invalid');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        selectedPoll
          ? `/api/projects/${encodeURIComponent(projectId)}/polls/${encodeURIComponent(selectedPoll.id)}`
          : `/api/projects/${encodeURIComponent(projectId)}/polls`,
        {
          method: selectedPoll ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title,
            description: form.description.trim() || null,
            status: form.status,
            allow_public_votes: form.allowPublicVotes,
            closes_at: closesAt,
            options,
          }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        poll?: PollRecord;
      };

      if (!response.ok || !payload.poll) {
        throw new Error(payload.error || 'Failed to save poll');
      }

      setPolls((current) => upsertPoll(current, payload.poll as PollRecord));
      setEditorOpen(false);
      setSelectedPoll(null);
      setForm(EMPTY_FORM);
      toast.success(selectedPoll ? 'Poll updated' : 'Poll created');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save poll',
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePoll = async () => {
    if (!projectId || !selectedPoll) return;

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/polls/${encodeURIComponent(selectedPoll.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete poll');
      }

      setPolls((current) =>
        current.filter((poll) => poll.id !== selectedPoll.id),
      );
      setEditorOpen(false);
      setSelectedPoll(null);
      setForm(EMPTY_FORM);
      setDeleteModalOpen(false);
      toast.success('Poll deleted');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete poll',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Polls"
        description="Create member polls, publish them to the site, and track vote totals."
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search polls"
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
                {['draft', 'published', 'closed'].map((s) => (
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
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={publicVotesOnly}
                  onSelect={(e) => {
                    e.preventDefault?.();
                    setPublicVotesOnly((v) => !v);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                      {publicVotesOnly ? (
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
                    <span>Allow public votes</span>
                  </span>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManagePolls ? (
              <Button type="button" onClick={openCreateModal}>
                + New Poll
              </Button>
            ) : null}
          </div>
        }
      />

      {!canManagePolls ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Only owners and admins can create or edit polls. You can still review
          current poll activity here.
        </div>
      ) : null}

      <div className="space-y-3">
        {loading ? <DashboardLoadingList keyPrefix="poll-loading" /> : null}

        {/** filter polls by search */}
        {/** compute filteredPolls below */}
        {!loading && filteredPolls.length === 0 && (
          <DashboardEmptyState message="No polls yet. Create one to collect votes from members or the public site." />
        )}

        {!loading &&
          filteredPolls.map((poll) => {
            const content = (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{poll.title}</p>
                      <Badge variant="outline">{poll.status}</Badge>
                      {poll.allow_public_votes ? (
                        <Badge>Public voting</Badge>
                      ) : null}
                    </div>
                    {poll.description ? (
                      <p className="text-muted-foreground text-sm">
                        {poll.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-muted-foreground text-right text-xs">
                    <div>
                      {poll.total_votes} vote{poll.total_votes === 1 ? '' : 's'}
                    </div>
                    <div>{formatPollDate(poll.closes_at)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {poll.poll_options.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>{option.option_text}</span>
                      <span className="text-muted-foreground">
                        {option.vote_count} vote
                        {option.vote_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );

            if (!canManagePolls) {
              return (
                <div key={poll.id} className="rounded-md border p-4">
                  {content}
                </div>
              );
            }

            return (
              <div key={poll.id} className="w-full rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex-1"
                    onClick={() => openEditModal(poll)}
                    role="button"
                  >
                    {content}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(poll)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPoll(poll);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setSelectedPoll(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPoll ? 'Edit Poll' : 'New Poll'}</DialogTitle>
            <DialogDescription>
              Set the question, choose the poll options, then decide whether it
              stays draft, goes live, or closes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="poll-title"
                className="text-muted-foreground text-xs"
              >
                Title
              </label>
              <Input
                id="poll-title"
                value={form.title}
                maxLength={160}
                placeholder="Which day works best for the next club event?"
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
                htmlFor="poll-description"
                className="text-muted-foreground text-xs"
              >
                Description
              </label>
              <Textarea
                id="poll-description"
                rows={5}
                maxLength={3000}
                placeholder="Add context for voters."
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
              <div className="text-muted-foreground text-right text-xs">
                {form.description.length}/3000
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="poll-status"
                  className="text-muted-foreground text-xs"
                >
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      status: normalizeStatus(value),
                    }))
                  }
                >
                  <SelectTrigger id="poll-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="poll-closes-at"
                  className="text-muted-foreground text-xs"
                >
                  Closes At
                </label>
                <Input
                  id="poll-closes-at"
                  type="datetime-local"
                  value={form.closesAt}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      closesAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={form.allowPublicVotes}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    allowPublicVotes: Boolean(checked),
                  }))
                }
              />
              <span>Allow voting from the public site</span>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs">Options</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((prev) =>
                      prev.options.length >= 8
                        ? prev
                        : { ...prev, options: [...prev.options, ''] },
                    )
                  }
                  disabled={form.options.length >= 8}
                >
                  Add Option
                </Button>
              </div>

              {form.options.map((option, index) => (
                <div key={`poll-option-${index}`} className="flex gap-2">
                  <Input
                    value={option}
                    maxLength={120}
                    placeholder={`Option ${index + 1}`}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        options: prev.options.map((current, currentIndex) =>
                          currentIndex === index ? event.target.value : current,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        options:
                          prev.options.length <= 2
                            ? prev.options
                            : prev.options.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                      }))
                    }
                    disabled={form.options.length <= 2}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              {selectedPoll ? (
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
                onClick={() => setEditorOpen(false)}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void savePoll()}
                disabled={saving || deleting}
              >
                {saving
                  ? 'Saving...'
                  : selectedPoll
                    ? 'Save Changes'
                    : 'Create Poll'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setSelectedPoll(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete poll?</DialogTitle>
            <DialogDescription>
              {selectedPoll
                ? `This will permanently delete "${selectedPoll.title}".`
                : 'This will permanently delete this poll.'}
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
              onClick={() => void deletePoll()}
              disabled={!selectedPoll || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Poll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeStatus(value: string): PollForm['status'] {
  if (value === 'published' || value === 'closed') return value;
  return 'draft';
}

function upsertPoll(current: PollRecord[], nextPoll: PollRecord) {
  const next = [...current];
  const index = next.findIndex((poll) => poll.id === nextPoll.id);

  if (index < 0) {
    next.unshift(nextPoll);
  } else {
    next[index] = nextPoll;
  }

  return next.sort(sortPolls);
}

function sortPolls(a: PollRecord, b: PollRecord) {
  const statusDelta = statusWeight(b.status) - statusWeight(a.status);
  if (statusDelta !== 0) return statusDelta;

  return compareDateDesc(a.created_at, b.created_at);
}

function statusWeight(status: PollRecord['status']) {
  if (status === 'published') return 3;
  if (status === 'draft') return 2;
  return 1;
}

function compareDateDesc(a: string | null, b: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
}

function formatPollDate(value: string | null) {
  if (!value) return 'No closing date';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No closing date';

  return `Closes ${parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
}

function toDateTimeLocalInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeDateTimeLocal(value: string) {
  if (!value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}
