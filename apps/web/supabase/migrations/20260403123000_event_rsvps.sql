CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  guest_token TEXT,
  responder_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT event_rsvps_identity_check CHECK (
    account_id IS NOT NULL OR guest_token IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_project ON public.event_rsvps(project_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON public.event_rsvps(status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_rsvps_account
  ON public.event_rsvps(event_id, account_id)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_rsvps_guest
  ON public.event_rsvps(event_id, guest_token)
  WHERE guest_token IS NOT NULL;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view event rsvps" ON public.event_rsvps;
CREATE POLICY "Project members can view event rsvps"
  ON public.event_rsvps FOR SELECT
  USING (public.is_project_member(event_rsvps.project_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can view event rsvps" ON public.event_rsvps;
CREATE POLICY "Owners can view event rsvps"
  ON public.event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = event_rsvps.project_id
        AND projects.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_rsvps TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_event_rsvps_updated_at ON public.event_rsvps;
CREATE TRIGGER set_event_rsvps_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
