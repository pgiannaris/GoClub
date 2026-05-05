/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getProjectTaskById } from '../route';

type ProjectRouteContext = {
  params: Promise<{ id: string; taskId: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { id: projectId, taskId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  if (!canManageTasks(role)) {
    return NextResponse.json(
      { error: 'Only owner/admin can manage tasks' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = parseTaskUpdateBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Valid task data is required' }, { status: 400 });
  }

  const existingTask = await getProjectTaskById(adminClient, projectId, taskId);
  if (!existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (parsed.assignee_id) {
    const assigneeResult = await verifyProjectAssignee(adminClient, projectId, parsed.assignee_id);
    if ('response' in assigneeResult) {
      return assigneeResult.response;
    }
  }

  const updates: Record<string, unknown> = {};

  if ('title' in parsed) updates.title = parsed.title;
  if ('description' in parsed) updates.description = parsed.description;
  if ('status' in parsed) updates.status = parsed.status;
  if ('priority' in parsed) updates.priority = parsed.priority;
  if ('due_date' in parsed) updates.due_date = parsed.due_date;
  if ('assignee_id' in parsed) updates.assignee_id = parsed.assignee_id;

  const { error: updateError } = await (adminClient as any)
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (updateError) {
    console.error('Failed to update task', { projectId, taskId, updateError });
    return NextResponse.json(
      { error: updateError.message || 'Failed to update task' },
      { status: 400 },
    );
  }

  const task = await getProjectTaskById(adminClient, projectId, taskId);
  if (!task) {
    return NextResponse.json({ error: 'Failed to load updated task' }, { status: 500 });
  }

  return NextResponse.json({ task }, { status: 200 });
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  const { id: projectId, taskId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;

  if (!canManageTasks(role)) {
    return NextResponse.json(
      { error: 'Only owner/admin can manage tasks' },
      { status: 403 },
    );
  }

  const { error } = await (adminClient as any)
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (error) {
    console.error('Failed to delete task', { projectId, taskId, error });
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function authorizeProjectAccess(projectId: string) {
  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: project, error: projectError } = await (client as any)
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return {
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    };
  }

  if (project.owner_id === user.id) {
    return { adminClient, role: 'owner' as const };
  }

  const { data: selfMember, error: memberError } = await (client as any)
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('account_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('Failed to authorize project access for tasks', {
      projectId,
      userId: user.id,
      memberError,
    });

    return {
      response: NextResponse.json(
        { error: 'Failed to verify project access' },
        { status: 500 },
      ),
    };
  }

  const role = normalizeProjectRole(selfMember?.role);
  if (!role) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { adminClient, role };
}

function normalizeProjectRole(value: unknown): ProjectAccessRole | null {
  if (value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer') {
    return value;
  }

  return null;
}

function canManageTasks(role: ProjectAccessRole) {
  return role === 'owner' || role === 'admin';
}

function parseTaskUpdateBody(body: unknown):
  | ({
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_date?: string | null;
      assignee_id?: string | null;
    } & Record<string, unknown>)
  | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const parsed: Record<string, unknown> = {};

  if ('title' in body) {
    const value = (body as { title?: unknown }).title;
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().slice(0, 160);
    if (!normalized) {
      return null;
    }

    parsed.title = normalized;
  }

  if ('description' in body) {
    const value = (body as { description?: unknown }).description;
    if (value !== null && typeof value !== 'string') {
      return null;
    }

    parsed.description = typeof value === 'string' ? value.trim().slice(0, 3000) || null : null;
  }

  if ('status' in body) {
    parsed.status = normalizeTaskStatus((body as { status?: unknown }).status);
  }

  if ('priority' in body) {
    parsed.priority = normalizeTaskPriority((body as { priority?: unknown }).priority);
  }

  if ('due_date' in body) {
    const normalized = normalizeDateOnly((body as { due_date?: unknown }).due_date);
    const rawValue = (body as { due_date?: unknown }).due_date;
    if (typeof rawValue === 'string' && rawValue.trim() && !normalized) {
      return null;
    }

    parsed.due_date = normalized;
  }

  if ('assignee_id' in body) {
    const value = (body as { assignee_id?: unknown }).assignee_id;
    if (value !== null && typeof value !== 'string') {
      return null;
    }

    parsed.assignee_id = typeof value === 'string' ? value.trim() || null : null;
  }

  if (Object.keys(parsed).length === 0) {
    return null;
  }

  return parsed;
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === 'todo' || value === 'in_progress' || value === 'done') {
    return value;
  }

  return 'todo';
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  return 'medium';
}

function normalizeDateOnly(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

async function verifyProjectAssignee(adminClient: any, projectId: string, assigneeId: string) {
  const { data: assignee, error } = await (adminClient as any)
    .from('member_profiles')
    .select('id')
    .eq('project_id', projectId)
    .eq('id', assigneeId)
    .maybeSingle();

  if (error) {
    console.error('Failed to validate task assignee', { projectId, assigneeId, error });
    return {
      response: NextResponse.json(
        { error: error.message || 'Failed to validate assignee' },
        { status: 400 },
      ),
    };
  }

  if (!assignee) {
    return {
      response: NextResponse.json(
        { error: 'Assignee must belong to this project roster' },
        { status: 400 },
      ),
    };
  }

  return { assignee };
}
