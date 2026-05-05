/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

type ProjectRouteContext = {
  params: Promise<{ id: string }>;
};

type ProjectAccessRole = 'owner' | 'admin' | 'member' | 'viewer';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

const TASK_SELECT =
  'id, project_id, title, description, status, priority, due_date, assignee_id, created_by, created_at, updated_at, assignee:member_profiles(id, full_name, email)';

export async function GET(_request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role } = authorization;
  const tasksResult = await getProjectTasks(adminClient, projectId);

  if ('response' in tasksResult) {
    return tasksResult.response;
  }

  const { data: members, error: membersError } = await (adminClient as any)
    .from('member_profiles')
    .select('id, full_name, email')
    .eq('project_id', projectId)
    .order('full_name', { ascending: true });

  if (membersError) {
    console.error('Failed to load task assignees', { projectId, membersError });
    return NextResponse.json(
      { error: membersError.message || 'Failed to load task assignees' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      tasks: tasksResult.tasks,
      members: members ?? [],
      permissions: {
        canManage: canManageTasks(role),
      },
    },
    { status: 200 },
  );
}

export async function POST(request: Request, context: ProjectRouteContext) {
  const { id: projectId } = await context.params;
  const authorization = await authorizeProjectAccess(projectId);

  if ('response' in authorization) {
    return authorization.response;
  }

  const { adminClient, role, user } = authorization;

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

  const parsed = parseTaskCreateBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Valid task data is required' }, { status: 400 });
  }

  if (parsed.assignee_id) {
    const assigneeResult = await verifyProjectAssignee(adminClient, projectId, parsed.assignee_id);
    if ('response' in assigneeResult) {
      return assigneeResult.response;
    }
  }

  const { data: task, error: taskError } = await (adminClient as any)
    .from('tasks')
    .insert({
      project_id: projectId,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      priority: parsed.priority,
      due_date: parsed.due_date,
      assignee_id: parsed.assignee_id,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (taskError || !task) {
    console.error('Failed to create task', { projectId, taskError });
    return NextResponse.json(
      { error: taskError?.message || 'Failed to create task' },
      { status: 400 },
    );
  }

  const hydratedTask = await getProjectTaskById(adminClient, projectId, task.id);
  if (!hydratedTask) {
    return NextResponse.json(
      { error: 'Task created but could not be loaded' },
      { status: 500 },
    );
  }

  return NextResponse.json({ task: hydratedTask }, { status: 200 });
}

export async function getProjectTaskById(adminClient: any, projectId: string, taskId: string) {
  const { data } = await (adminClient as any)
    .from('tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)
    .eq('id', taskId)
    .maybeSingle();

  return data ?? null;
}

async function getProjectTasks(adminClient: any, projectId: string) {
  const { data, error } = await (adminClient as any)
    .from('tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load tasks', { projectId, error });
    return {
      response: NextResponse.json(
        { error: error.message || 'Failed to load tasks' },
        { status: 400 },
      ),
    };
  }

  return {
    tasks: data ?? [],
  };
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
    return { adminClient, user, role: 'owner' as const };
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

  return { adminClient, user, role };
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

function parseTaskCreateBody(body: unknown): {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
} | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const rawTitle = (body as { title?: unknown }).title;
  if (typeof rawTitle !== 'string') {
    return null;
  }

  const title = rawTitle.trim().slice(0, 160);
  if (!title) {
    return null;
  }

  return {
    title,
    description: normalizeOptionalString((body as { description?: unknown }).description, 3000),
    status: normalizeTaskStatus((body as { status?: unknown }).status),
    priority: normalizeTaskPriority((body as { priority?: unknown }).priority),
    due_date: normalizeDateOnly((body as { due_date?: unknown }).due_date),
    assignee_id: normalizeNullableId((body as { assignee_id?: unknown }).assignee_id),
  };
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === 'in_progress' || value === 'done') {
    return value;
  }

  return 'todo';
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  if (value === 'low' || value === 'high') {
    return value;
  }

  return 'medium';
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeNullableId(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeDateOnly(value: unknown) {
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
