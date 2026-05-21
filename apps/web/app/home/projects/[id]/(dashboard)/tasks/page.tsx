'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useParams } from 'next/navigation';

import { LayoutDashboard, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { DatePickerField } from '../_components/date-time-picker-field';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

type TaskAssignee = {
  id: string;
  full_name: string;
  email: string | null;
};

type TaskRecord = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  assignee: TaskAssignee | null;
};

type TaskForm = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
};

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  assigneeId: '',
};

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

// ─── Spring physics helpers ───────────────────────────────────────────────────

const SPRING = 0.11; // stiffness  (lower = less snap)
const DAMPING = 0.82; // friction   (higher = less jitter)
const TILT_FACTOR = 0.1; // how much horizontal velocity tilts the card

// ─── Component ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [members, setMembers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManageTasks, setCanManageTasks] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | string>('all');
  const [actingTaskId, setActingTaskId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskRecord | null>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────

  /** The card currently being shown as a physics ghost */
  const [dragCard, setDragCard] = useState<{
    task: TaskRecord;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
    opacity: number;
  } | null>(null);

  /** Which column the ghost is hovering over */
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  /** Mutable physics state – lives in a ref so RAF can write without re-render */
  const physicsRef = useRef<{
    ghostX: number;
    ghostY: number;
    targetX: number;
    targetY: number;
    velX: number;
    velY: number;
    cursorOffsetX: number; // offset from card top-left to cursor
    cursorOffsetY: number;
    width: number;
    height: number;
    task: TaskRecord;
    rafId: number;
    originX: number; // where the card started (for spring-back)
    originY: number;
    releasing: boolean; // true while springing back to origin after drop
  } | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/tasks`,
          { credentials: 'include' },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          tasks?: TaskRecord[];
          members?: TaskAssignee[];
          permissions?: { canManage?: boolean };
        };
        if (!response.ok)
          throw new Error(payload.error || 'Failed to load tasks');
        if (cancelled) return;
        setTasks(payload.tasks ?? []);
        setMembers(payload.members ?? []);
        setCanManageTasks(Boolean(payload.permissions?.canManage));
      } catch (error) {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : 'Failed to load tasks',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (assigneeFilter !== 'all' && task.assignee_id !== assigneeFilter)
        return false;
      if (!query) return true;
      return [
        task.title,
        task.description,
        task.assignee?.full_name,
        task.priority,
        task.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [searchQuery, statusFilter, tasks, assigneeFilter]);

  const groupedTasks = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        tasks: filteredTasks.filter((task) => task.status === status),
      })),
    [filteredTasks],
  );

  // ── Task mutations ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setSelectedTask(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };
  const openEditModal = (task: TaskRecord) => {
    setSelectedTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date ?? '',
      assigneeId: task.assignee_id ?? '',
    });
    setEditorOpen(true);
  };

  const saveTask = async () => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }
    const title = form.title.trim();
    if (!title) {
      toast.error('Enter a task title');
      return;
    }

    if (!form.assigneeId) {
      toast.error('Assign task to a student');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        selectedTask
          ? `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(selectedTask.id)}`
          : `/api/projects/${encodeURIComponent(projectId)}/tasks`,
        {
          method: selectedTask ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title,
            description: form.description.trim() || null,
            status: form.status,
            priority: form.priority,
            due_date: form.dueDate || null,
            assignee_id: form.assigneeId || null,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        task?: TaskRecord;
      };
      if (!response.ok || !payload.task)
        throw new Error(payload.error || 'Failed to save task');
      setTasks((current) => upsertTask(current, payload.task as TaskRecord));
      setEditorOpen(false);
      setSelectedTask(null);
      setForm(EMPTY_FORM);
      toast.success(selectedTask ? 'Task updated' : 'Task created');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save task',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (task: TaskRecord, status: TaskStatus) => {
    if (!projectId || task.status === status) return;

    // Optimistic: move the card to the new column right away
    const previousStatus = task.status;
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );

    setActingTaskId(task.id);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        task?: TaskRecord;
      };
      if (!response.ok || !payload.task)
        throw new Error(payload.error || 'Failed to update task');
      // Sync server response (updated_at etc.) without re-sorting position
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id ? { ...(payload.task as TaskRecord) } : t,
        ),
      );
    } catch (error) {
      // Revert to original status on failure
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id ? { ...t, status: previousStatus } : t,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : 'Failed to update task',
      );
    } finally {
      setActingTaskId(null);
    }
  };

  const requestDeleteTask = (task: TaskRecord) => {
    setTaskToDelete(task);
    setDeleteModalOpen(true);
  };
  const confirmDeleteTask = async () => {
    if (!projectId || !taskToDelete) return;
    setActingTaskId(taskToDelete.id);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskToDelete.id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || 'Failed to delete task');
      setTasks((current) =>
        current.filter((entry) => entry.id !== taskToDelete.id),
      );
      toast.success('Task deleted');
      setDeleteModalOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete task',
      );
    } finally {
      setActingTaskId(null);
    }
  };

  // ── Physics drag handlers ───────────────────────────────────────────────────

  const stopDrag = () => {
    if (!physicsRef.current) return;
    cancelAnimationFrame(physicsRef.current.rafId);
    physicsRef.current = null;
    setDragCard(null);
    setDropTarget(null);
  };

  const handleCardPointerDown = (e: React.PointerEvent, task: TaskRecord) => {
    if (!canManageTasks) return;
    // Only primary button (left click / touch)
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorOffsetX = e.clientX - rect.left;
    const cursorOffsetY = e.clientY - rect.top;

    const startX = rect.left;
    const startY = rect.top;

    const physics = {
      ghostX: startX,
      ghostY: startY,
      targetX: startX,
      targetY: startY,
      velX: 0,
      velY: 0,
      cursorOffsetX,
      cursorOffsetY,
      width: rect.width,
      height: rect.height,
      task,
      rafId: 0,
      originX: startX,
      originY: startY,
      releasing: false,
    };
    physicsRef.current = physics;

    setDragCard({
      task,
      x: startX,
      y: startY,
      rotation: 0,
      width: rect.width,
      height: rect.height,
      opacity: 1,
    });

    const tick = () => {
      const p = physicsRef.current;
      if (!p) return;

      p.velX = p.velX * DAMPING + (p.targetX - p.ghostX) * SPRING;
      p.velY = p.velY * DAMPING + (p.targetY - p.ghostY) * SPRING;
      p.ghostX += p.velX;
      p.ghostY += p.velY;

      const rotation = p.velX * TILT_FACTOR;

      // When springing back to origin, fade out and stop once settled
      if (p.releasing) {
        const dist = Math.hypot(p.ghostX - p.originX, p.ghostY - p.originY);
        const speed = Math.hypot(p.velX, p.velY);
        if (dist < 1.5 && speed < 0.5) {
          stopDrag();
          return;
        }
        setDragCard({
          task: p.task,
          x: p.ghostX,
          y: p.ghostY,
          rotation,
          width: p.width,
          height: p.height,
          opacity: Math.min(1, dist / 40),
        });
        p.rafId = requestAnimationFrame(tick);
        return;
      }

      setDragCard({
        task: p.task,
        x: p.ghostX,
        y: p.ghostY,
        rotation,
        width: p.width,
        height: p.height,
        opacity: 1,
      });

      // Detect which column we're over via the cursor position
      const cursorX = p.targetX + p.cursorOffsetX;
      const cursorY = p.targetY + p.cursorOffsetY;
      const el = document.elementFromPoint(cursorX, cursorY);
      const col = el?.closest('[data-droptarget]');
      const status = col?.getAttribute('data-droptarget') as TaskStatus | null;
      setDropTarget(status ?? null);

      p.rafId = requestAnimationFrame(tick);
    };

    physics.rafId = requestAnimationFrame(tick);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const p = physicsRef.current;
    if (!p || p.releasing) return;
    p.targetX = e.clientX - p.cursorOffsetX;
    p.targetY = e.clientY - p.cursorOffsetY;
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    const p = physicsRef.current;
    if (!p) return;

    const cursorX = e.clientX;
    const cursorY = e.clientY;
    const el = document.elementFromPoint(cursorX, cursorY);
    const col = el?.closest('[data-droptarget]');
    const newStatus = col?.getAttribute('data-droptarget') as TaskStatus | null;

    if (newStatus && newStatus !== p.task.status) {
      // Dropped on a new column: update optimistically and dismiss ghost immediately
      void updateTaskStatus(p.task, newStatus);
      stopDrag();
    } else {
      // Dropped on same column or outside: spring the ghost back to where it came from
      setDropTarget(null);
      p.releasing = true;
      p.targetX = p.originX;
      p.targetY = p.originY;
    }
  };

  // ── Pointer cancel (e.g. ESC, focus lost) ──────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && physicsRef.current) stopDrag();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Ghost overlay – rendered on top of everything via fixed positioning */}
      {dragCard && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: dragCard.x,
            top: dragCard.y,
            width: dragCard.width,
            height: dragCard.height,
            transform: `rotate(${dragCard.rotation}deg) scale(1.04)`,
            transformOrigin: 'center center',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: dragCard.opacity,
            filter: 'drop-shadow(0 20px 32px rgba(0,0,0,0.22))',
            willChange: 'transform',
          }}
        >
          <TaskCardGhost task={dragCard.task} />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Assign club work, track progress, and keep action items visible for
            the team.
          </p>
        </div>
        {canManageTasks ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-md p-2 ${viewMode === 'board' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
                onClick={() => setViewMode('board')}
                type="button"
                aria-label="Board view"
                title="Board view"
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
              <button
                className={`rounded-md p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
                onClick={() => setViewMode('list')}
                type="button"
                aria-label="List view"
                title="List view"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="6" y2="6" />
                  <line x1="3" y1="12" x2="6" y2="12" />
                  <line x1="3" y1="18" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <Button type="button" onClick={openCreateModal}>
              + New Task
            </Button>
          </div>
        ) : null}
      </div>

      {!canManageTasks ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Only owners and admins can create or edit tasks. You can still review
          the board here.
        </div>
      ) : null}

      <Card className="bg-card border-border">
        <br />
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <Input
              placeholder="Search tasks"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select
              className="bg-background h-10 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                setStatusFilter(
                  value === 'all' ? 'all' : normalizeTaskStatus(value),
                );
              }}
            >
              <option value="all">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <select
              className="bg-background h-10 rounded-md border px-3 text-sm"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value as any)}
            >
              <option value="all">All students</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <div className="ml-auto" />
          </div>

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`task-loading-${index}`}
                  className="rounded-md border p-4"
                >
                  <div className="bg-muted/60 h-4 w-32 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
              No tasks match the current filters.
            </div>
          ) : viewMode === 'board' ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {groupedTasks.map((group) => {
                const isOver = dropTarget === group.status;
                return (
                  <div
                    key={group.status}
                    data-droptarget={group.status}
                    className={`space-y-3 rounded-xl border p-4 transition-colors duration-150 ${
                      isOver
                        ? 'border-primary/50 bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.3)]'
                        : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">
                          {formatTaskStatus(group.status)}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {group.tasks.length} task
                          {group.tasks.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Badge variant="outline">{group.tasks.length}</Badge>
                    </div>

                    {group.tasks.length === 0 ? (
                      <div
                        className="text-muted-foreground rounded-md border border-dashed p-4 text-sm transition-colors duration-150"
                        style={{
                          borderColor: isOver
                            ? 'hsl(var(--primary) / 0.45)'
                            : undefined,
                        }}
                      >
                        {isOver ? 'Drop here' : 'Nothing here yet.'}
                      </div>
                    ) : (
                      group.tasks.map((task) => {
                        const isBeingDragged = dragCard?.task.id === task.id;
                        return (
                          <div
                            key={task.id}
                            className="bg-card space-y-3 rounded-lg border p-4 shadow-sm transition-opacity duration-500"
                            style={{
                              opacity: isBeingDragged ? 0.5 : 1,
                              cursor: canManageTasks ? 'grab' : 'default',
                              // Prevent text selection during drag
                              userSelect: 'none',
                            }}
                            onPointerDown={(e) =>
                              handleCardPointerDown(e, task)
                            }
                            onPointerMove={handleCardPointerMove}
                            onPointerUp={handleCardPointerUp}
                            onPointerCancel={stopDrag}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{task.title}</p>
                                  <Badge variant="outline">
                                    {formatPriority(task.priority)}
                                  </Badge>
                                </div>
                                {task.description ? (
                                  <p className="text-muted-foreground text-sm">
                                    {task.description}
                                  </p>
                                ) : null}
                              </div>
                              {canManageTasks ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(task);
                                    }}
                                    aria-label={`Edit ${task.title}`}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={actingTaskId === task.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestDeleteTask(task);
                                    }}
                                    aria-label={`Delete ${task.title}`}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground space-y-2 text-sm">
                              <div>
                                Assignee:{' '}
                                <span className="text-foreground">
                                  {task.assignee?.full_name || 'Unassigned'}
                                </span>
                              </div>
                              <div>
                                Due:{' '}
                                <span className="text-foreground">
                                  {task.due_date
                                    ? formatDueDate(task.due_date)
                                    : 'No due date'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Empty drop zone at bottom when column has cards */}
                    {isOver && group.tasks.length > 0 && (
                      <div className="border-primary/40 h-2 rounded-md border border-dashed transition-all duration-150" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // ── List view (unchanged) ─────────────────────────────────────────
            <div className="bg-card overflow-x-auto rounded-lg border">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-muted-foreground text-left text-sm">
                    <th className="px-3 py-2">Done</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Assignee</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          disabled={!canManageTasks || actingTaskId === task.id}
                          onChange={() =>
                            void updateTaskStatus(
                              task,
                              task.status === 'done' ? 'todo' : 'done',
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium">{task.title}</div>
                        {task.description ? (
                          <div className="text-muted-foreground text-sm">
                            {task.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge variant="outline">
                          {formatPriority(task.priority)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {task.assignee?.full_name || 'Unassigned'}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {task.due_date ? formatDueDate(task.due_date) : '—'}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {canManageTasks ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(task)}
                              aria-label={`Edit ${task.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={actingTaskId === task.id}
                              onClick={() => requestDeleteTask(task)}
                              aria-label={`Delete ${task.title}`}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Editor dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTask ? 'Edit task' : 'Create task'}
            </DialogTitle>
            <DialogDescription>
              Assign work to a roster member and keep the status current.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((c) => ({ ...c, title: event.target.value }))
                }
                placeholder="Prepare tournament brackets"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((c) => ({ ...c, description: event.target.value }))
                }
                rows={4}
                placeholder="Add the details, handoff notes, or anything the assignee should know."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={form.status}
                  onChange={(event) =>
                    setForm((c) => ({
                      ...c,
                      status: normalizeTaskStatus(event.target.value),
                    }))
                  }
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((c) => ({
                      ...c,
                      priority: normalizeTaskPriority(event.target.value),
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to</label>
                <select
                  className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={form.assigneeId}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, assigneeId: event.target.value }))
                  }
                >
                  <option value="">Select a student</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                      {member.email ? ` (${member.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due date</label>
                <DatePickerField
                  value={form.dueDate}
                  onChange={(value) =>
                    setForm((c) => ({ ...c, dueDate: value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={() => void saveTask()} disabled={saving}>
                {saving
                  ? 'Saving...'
                  : selectedTask
                    ? 'Save changes'
                    : 'Create task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This will permanently remove this task from the project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={actingTaskId === taskToDelete?.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteTask()}
              disabled={!taskToDelete || actingTaskId === taskToDelete.id}
            >
              {actingTaskId === taskToDelete?.id
                ? 'Deleting...'
                : 'Delete Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Ghost card rendered inside the fixed-position overlay ───────────────────
// Mirrors the visual structure of a board card without interactive elements.

function TaskCardGhost({ task }: { task: TaskRecord }) {
  return (
    <div className="bg-card h-full space-y-3 rounded-lg border p-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{task.title}</p>
          <Badge variant="outline">{formatPriority(task.priority)}</Badge>
        </div>
        {task.description ? (
          <p className="text-muted-foreground text-sm">{task.description}</p>
        ) : null}
      </div>
      <div className="text-muted-foreground space-y-2 text-sm">
        <div>
          Assignee:{' '}
          <span className="text-foreground">
            {task.assignee?.full_name || 'Unassigned'}
          </span>
        </div>
        <div>
          Due:{' '}
          <span className="text-foreground">
            {task.due_date ? formatDueDate(task.due_date) : 'No due date'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function upsertTask(current: TaskRecord[], task: TaskRecord) {
  const next = current.filter((entry) => entry.id !== task.id);
  return [task, ...next].sort((left, right) => {
    const leftDate = left.updated_at || left.created_at || '';
    const rightDate = right.updated_at || right.created_at || '';
    return rightDate.localeCompare(leftDate);
  });
}

function normalizeTaskStatus(value: string): TaskStatus {
  if (value === 'in_progress' || value === 'done') return value;
  return 'todo';
}

function normalizeTaskPriority(value: string): TaskPriority {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
}

function formatTaskStatus(status: TaskStatus) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'done') return 'Done';
  return 'To Do';
}

function formatPriority(priority: TaskPriority) {
  if (priority === 'high') return 'High Priority';
  if (priority === 'low') return 'Low Priority';
  return 'Medium Priority';
}

function formatDueDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
