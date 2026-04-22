-- Ensure account deletion can null out historical references instead of failing.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_created_by_fkey'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events DROP CONSTRAINT events_created_by_fkey;
  END IF;

  ALTER TABLE public.events
    ADD CONSTRAINT events_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.accounts(id)
    ON DELETE SET NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_invited_by_fkey'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members DROP CONSTRAINT project_members_invited_by_fkey;
  END IF;

  ALTER TABLE public.project_members
    ADD CONSTRAINT project_members_invited_by_fkey
    FOREIGN KEY (invited_by)
    REFERENCES public.accounts(id)
    ON DELETE SET NULL;
END;
$$;
