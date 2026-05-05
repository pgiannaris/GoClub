'use client';

import { useState } from 'react';

import { LayoutDashboard } from 'lucide-react';

export default function TasksViewClient({
  tasks: initialTasks,
  projectId,
  canManage,
}: {
  tasks: any[];
  projectId: string;
  canManage: boolean;
}) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = useState(initialTasks || []);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  async function updateTaskStatus(taskId: string, status: string) {
    // optimistic
    setTasks((t) => t.map((x) => (x.id === taskId ? { ...x, status } : x)));
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTasks((t) => t.map((x) => (x.id === taskId ? data.task : x)));
    } catch (err) {
      console.error(err);
      // rollback by refetching list
      refetchTasks();
    }
  }

  async function refetchTasks() {
    const res = await fetch(`/api/projects/${projectId}/tasks`);
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.tasks || []);
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setTasks((t) => [data.task, ...t]);
      setNewTitle('');
    } catch (err) {
      console.error(err);
      alert('Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  const statuses = [
    { id: 'todo', label: 'To do' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'done', label: 'Done' },
  ];

  const todoCount = tasks.filter((t) => (t.status || 'todo') === 'todo').length;
  const inProgressCount = tasks.filter(
    (t) => (t.status || 'todo') === 'in_progress',
  ).length;
  const doneCount = tasks.filter((t) => (t.status || 'todo') === 'done').length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{tasks.length}</span> task
            {tasks.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              className={`rounded-md p-2 ${view === 'list' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}
              onClick={() => setView('list')}
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

            <button
              className={`rounded-md p-2 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}
              onClick={() => setView('kanban')}
              type="button"
              aria-label="Kanban view"
              title="Kanban view"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New task title"
                className="rounded-md border px-3 py-1"
              />
              <button
                onClick={createTask}
                disabled={creating}
                className="rounded-md bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
              >
                + New Task
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-muted-foreground mb-4 flex gap-2 text-sm">
        <div className="rounded-md bg-slate-100 px-2 py-1">
          To do: {todoCount}
        </div>
        <div className="rounded-md bg-slate-100 px-2 py-1">
          In progress: {inProgressCount}
        </div>
        <div className="rounded-md bg-slate-100 px-2 py-1">
          Done: {doneCount}
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {statuses.map((s) => (
            <div key={s.id} className="min-h-[200px]">
              <h3 className="mb-2 font-semibold">{s.label}</h3>
              <div className="space-y-3">
                {tasks
                  .filter((t) => (t.status || 'todo') === s.id)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border p-3"
                      style={{ background: 'white' }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-xs text-slate-500">
                            {task.due_date
                              ? `Due ${new Date(task.due_date).toLocaleDateString()}`
                              : ''}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {canManage ? (
                            <div className="flex flex-col gap-1">
                              {s.id !== 'done' && (
                                <button
                                  className="text-sm text-blue-600"
                                  onClick={() =>
                                    updateTaskStatus(
                                      task.id,
                                      s.id === 'todo' ? 'in_progress' : 'done',
                                    )
                                  }
                                  type="button"
                                >
                                  Move
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border" style={{ overflowX: 'auto' }}>
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2">Done</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={(task.status || 'todo') === 'done'}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateTaskStatus(
                          task.id,
                          e.target.checked ? 'done' : 'todo',
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-2">{task.title}</td>
                  <td className="px-4 py-2">{task.priority || 'medium'}</td>
                  <td className="px-4 py-2">
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
