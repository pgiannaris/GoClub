-- Canonical schema cleanup for GoClub core and club feature tables.
-- This migration is intentionally non-destructive: it backfills and constrains,
-- but does not drop legacy columns that older local databases may still carry.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Normalize core lookup-style columns with explicit constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_status_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('active', 'paused', 'archived', 'coming_up', 'restoring'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_role_check'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_role_check
      CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'announcements_status_check'
        AND conrelid = 'public.announcements'::regclass
    ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;

  IF to_regclass('public.events') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'events_status_check'
        AND conrelid = 'public.events'::regclass
    ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_status_check
      CHECK (status IN ('scheduled', 'cancelled', 'completed'));
  END IF;

  IF to_regclass('public.events') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'events_visibility_check'
        AND conrelid = 'public.events'::regclass
    ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_visibility_check
      CHECK (visibility IN ('public', 'members'));
  END IF;

  IF to_regclass('public.polls') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'polls_status_check'
        AND conrelid = 'public.polls'::regclass
    ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_status_check
      CHECK (status IN ('draft', 'published', 'closed'));
  END IF;

  IF to_regclass('public.tasks') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'tasks_status_check'
        AND conrelid = 'public.tasks'::regclass
    ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'done'));
  END IF;

  IF to_regclass('public.tasks') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'tasks_priority_check'
        AND conrelid = 'public.tasks'::regclass
    ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END;
$$;

-- Normalize events so the app uses a single canonical shape.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rsvp_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

UPDATE public.events
SET start_at = COALESCE(start_at, start_date),
    end_at = COALESCE(end_at, end_date),
    status = COALESCE(status, 'scheduled'),
    visibility = COALESCE(visibility, 'public'),
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE start_at IS NULL
   OR end_at IS NULL
   OR status IS NULL
   OR visibility IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.events
  ALTER COLUMN start_at SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'scheduled',
  ALTER COLUMN visibility SET DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_events_start_at ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);

COMMENT ON COLUMN public.events.start_at IS 'Canonical event start timestamp. Prefer this over the legacy start_date column.';
COMMENT ON COLUMN public.events.end_at IS 'Canonical event end timestamp. Prefer this over the legacy end_date column.';

-- Attendance sessions should track authorship and support updates consistently.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.attendance_sessions
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_meeting_date ON public.attendance_sessions(meeting_date);

-- Enforce one explicit vote per authenticated member while leaving anonymous public voting unchanged.
DROP INDEX IF EXISTS public.uniq_poll_vote_per_member;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_poll_votes_member
  ON public.poll_votes(poll_id, member_id)
  WHERE member_id IS NOT NULL;

-- Keep updated_at in sync on tables that are edited from the UI.
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_events_updated_at ON public.events;
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_member_profiles_updated_at ON public.member_profiles;
CREATE TRIGGER set_member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_announcements_updated_at ON public.announcements;
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_attendance_sessions_updated_at ON public.attendance_sessions;
CREATE TRIGGER set_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();